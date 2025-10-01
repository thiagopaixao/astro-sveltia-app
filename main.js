const { app, BrowserWindow, ipcMain, Menu, dialog, BrowserView } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { spawn } = require('child_process');
const { rimraf } = require('rimraf');

let mainWindow;
let editorView;
let viewerView;
let activeProcesses = {}; // To keep track of running child processes

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Hide the menu bar
  Menu.setApplicationMenu(null);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

let db;

function initializeDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'documental.db');

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
      db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectName TEXT NOT NULL,
        githubUrl TEXT NOT NULL,
        projectPath TEXT NOT NULL,
        repoFolderName TEXT
      )`, (err) => {
        if (err) {
          console.error('Error creating projects table:', err.message);
        } else {
          console.log('Projects table ensured.');
        }
      });
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  initializeDatabase();

  ipcMain.handle('get-home-directory', () => {
    return app.getPath('home');
  });

  ipcMain.handle('open-directory-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  ipcMain.handle('get-project-details', async (event, projectId) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT projectName, githubUrl, projectPath, repoFolderName FROM projects WHERE id = ?`, [projectId], (err, row) => {
        if (err) {
          console.error('Error getting project details:', err.message);
          reject(err.message);
        } else if (row) {
          resolve(row);
        } else {
          reject('Project not found');
        }
      });
    });
  });

  ipcMain.handle('save-project', async (event, projectData) => {
    return new Promise((resolve, reject) => {
      const { projectName, githubUrl, projectPath } = projectData;
      db.run(`INSERT INTO projects (projectName, githubUrl, projectPath, repoFolderName) VALUES (?, ?, ?, ?)`,
        [projectName, githubUrl, projectPath, null], // repoFolderName is null initially
        function (err) {
          if (err) {
            console.error('Error saving project:', err.message);
            reject(err.message);
          } else {
            console.log(`A row has been inserted with rowid ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  });

  ipcMain.handle('start-project-creation', async (event, projectId, projectPath, githubUrl) => {
    const sendOutput = (output) => {
      mainWindow.webContents.send('command-output', output);
    };

    const sendStatus = (status) => {
      mainWindow.webContents.send('command-status', status);
    };

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const executeCommand = (command, args, cwd, processId) => {
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd });
        activeProcesses[processId] = child;

        child.stdout.on('data', (data) => {
          sendOutput(data.toString());
        });

        child.stderr.on('data', (data) => {
          sendOutput(data.toString());
        });

        child.on('close', (code) => {
          delete activeProcesses[processId];
          if (code === 0) {
            resolve();
          } else {
            reject(`Command failed with code ${code}`);
          }
        });

        child.on('error', (err) => {
          delete activeProcesses[processId];
          reject(`Failed to start command: ${err.message}`);
        });
      });
    };

    try {
      // Step 1: git clone
      sendOutput('Cloning repository...\n');
      const repoName = githubUrl.split('/').pop().replace('.git', '');
      let finalRepoFolderName = repoName;
      let counter = 0;
      while (fs.existsSync(path.join(projectPath, finalRepoFolderName))) {
        counter++;
        finalRepoFolderName = `${repoName}-${counter}`;
      }
      const repoDirPath = path.join(projectPath, finalRepoFolderName);

      await executeCommand('git', ['clone', githubUrl, finalRepoFolderName], projectPath, projectId);
      sendOutput(`Repository cloned into ${repoDirPath}\n`);
      sendStatus('success');
      await delay(3000);

      // Update repoFolderName in DB
      await new Promise((resolve, reject) => {
        db.run(`UPDATE projects SET repoFolderName = ? WHERE id = ?`, [finalRepoFolderName, projectId], (err) => {
          if (err) {
            console.error('Error updating repoFolderName:', err.message);
            reject(err.message);
          } else {
            console.log(`repoFolderName updated for project ${projectId}`);
            resolve();
          }
        });
      });

      // Step 2: git checkout preview
      sendOutput('Checking out preview branch...\n');
      await executeCommand('git', ['checkout', 'preview'], repoDirPath, projectId);
      sendOutput('Checked out preview branch.\n');
      sendStatus('success');
      await delay(3000);

      // Step 3: npm install
      sendOutput('Installing dependencies...\n');
      await executeCommand('npm', ['install'], repoDirPath, projectId);
      sendOutput('Dependencies installed.\n');
      sendStatus('success');
      await delay(3000);

      // Step 4: npm run build
      sendOutput('Building project...\n');
      await executeCommand('npm', ['run', 'build'], repoDirPath, projectId);
      sendOutput('Project built.\n');
      sendStatus('success');
      await delay(3000);

      // Step 5: npm run dev (keep in background)
      sendOutput('Starting development server...\n');
      const devProcess = spawn('npm', ['run', 'dev'], { cwd: repoDirPath });
      activeProcesses[`dev-${projectId}`] = devProcess;

      devProcess.stdout.on('data', (data) => {
        sendOutput(data.toString());
      });

      devProcess.stderr.on('data', (data) => {
        sendOutput(data.toString());
      });

      devProcess.on('close', (code) => {
        delete activeProcesses[`dev-${projectId}`];
        if (code !== 0) {
          sendOutput(`Development server exited with code ${code}\n`);
          sendStatus('failure');
        }
      });

      let serverReady = false;
      const checkServerReady = (data) => {
        if (!serverReady && (data.includes('ready') || data.includes('compiled successfully') || data.includes('listening on'))) {
          serverReady = true;
          sendOutput('Development server is ready.\n');
          sendStatus('success'); // Mark as success only when server is truly ready
        }
      };

      let devServerUrl = null;
      const urlRegex = /http:\/\/localhost:\d+\//;

      const processOutput = (data) => {
        const output = data.toString();
        sendOutput(output);
        checkServerReady(output);

        if (!devServerUrl) {
          const match = output.match(urlRegex);
          if (match) {
            devServerUrl = match[0];
            console.log(`Development server URL: ${devServerUrl}`);
            mainWindow.webContents.send('dev-server-url', devServerUrl);
          }
        }
      };

      devProcess.stdout.on('data', processOutput);
      devProcess.stderr.on('data', processOutput);

      devProcess.on('close', (code) => {
        delete activeProcesses[`dev-${projectId}`];
        if (code !== 0) {
          sendOutput(`Development server exited with code ${code}\n`);
          sendStatus('failure');
        } else if (!serverReady) {
          // If process closed with code 0 but never reported ready, it might be an issue
          sendOutput('Development server closed without reporting readiness.\n');
          sendStatus('failure');
        }
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-${projectId}`];
        sendOutput(`Failed to start development server: ${err.message}\n`);
        sendStatus('failure');
      });

      sendOutput('Development server started in background. Waiting for readiness signal...\n');
      // Do NOT sendStatus('success') here. It will be sent when 'ready' string is detected.
    } catch (error) {
      sendOutput(`Error during project creation: ${error}\n`);
      sendStatus('failure');
      // Clean up if any step fails
      const repoName = githubUrl.split('/').pop().replace('.git', '');
      const repoDirPath = path.join(projectPath, repoName); // This might be incorrect if incremental naming was used
      if (fs.existsSync(repoDirPath)) {
        rimraf(repoDirPath).then(() => {
          console.log(`Cleaned up failed repository at ${repoDirPath}`);
        }).catch(err => {
          console.error(`Error cleaning up repository at ${repoDirPath}: ${err.message}`);
        });
      }
    }
  });

  ipcMain.handle('cancel-project-creation', async (event, projectId, projectPath, repoFolderName) => {
    // Terminate active processes for this project
    if (activeProcesses[projectId]) {
      activeProcesses[projectId].kill();
      delete activeProcesses[projectId];
    }
    if (activeProcesses[`dev-${projectId}`]) {
      activeProcesses[`dev-${projectId}`].kill();
      delete activeProcesses[`dev-${projectId}`];
    }

    // Delete the cloned repository folder
    if (repoFolderName) {
      const repoDirPath = path.join(projectPath, repoFolderName);
      if (fs.existsSync(repoDirPath)) {
        try {
          await rimraf(repoDirPath);
          console.log(`Repository folder ${repoDirPath} deleted.`);
          mainWindow.webContents.send('command-output', `Repository folder ${repoDirPath} deleted.\n`);
        } catch (err) {
          console.error(`Error deleting repository folder ${repoDirPath}: ${err.message}`);
          mainWindow.webContents.send('command-output', `Error deleting repository folder ${repoDirPath}: ${err.message}\n`);
        }
      }
    }
    mainWindow.webContents.send('command-status', 'cancelled');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function destroyBrowserViews() {
  if (editorView) {
    mainWindow.removeBrowserView(editorView);
    editorView.destroy();
    editorView = null;
  }
  if (viewerView) {
    mainWindow.removeBrowserView(viewerView);
    viewerView.destroy();
    viewerView = null;
  }
}

ipcMain.on('navigate', (event, page) => {
  if (mainWindow) {
    if (page === 'main.html') {
      // Load main.html into the main window's webContents
      mainWindow.loadFile(path.join(__dirname, 'renderer', page));

      // Create and manage BrowserViews for editor and viewer
      // These will be positioned on top of the main.html content
      if (!editorView) {
        editorView = new BrowserView({
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: false, // Ensure webviewTag is not used
            enableRemoteModule: false, // Recommended for security
          }
        });
        mainWindow.addBrowserView(editorView);
        editorView.webContents.loadURL('about:blank'); // Initial blank page
        editorView.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // Initially hidden
        editorView.webContents.openDevTools(); // For debugging
      }

      if (!viewerView) {
        viewerView = new BrowserView({
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: false,
            enableRemoteModule: false,
          }
        });
        mainWindow.addBrowserView(viewerView);
        viewerView.webContents.loadURL('about:blank'); // Initial blank page
        viewerView.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // Initially hidden
        viewerView.webContents.openDevTools(); // For debugging
      }

      // IPC handlers for BrowserView control
      ipcMain.handle('set-browser-view-bounds', (event, viewName, bounds) => {
        const view = viewName === 'editor' ? editorView : viewerView;
        if (view) {
          view.setBounds(bounds);
        }
      });

      ipcMain.handle('load-browser-view-url', (event, viewName, url) => {
        const view = viewName === 'editor' ? editorView : viewerView;
        if (view) {
          view.webContents.loadURL(url);
        }
      });

      ipcMain.handle('set-browser-view-visibility', (event, viewName, visible) => {
        const view = viewName === 'editor' ? editorView : viewerView;
        if (view) {
          if (visible) {
            mainWindow.addBrowserView(view);
          } else {
            mainWindow.removeBrowserView(view);
          }
        }
      });

    } else {
      // For other pages (like create.html), destroy BrowserViews
      destroyBrowserViews();
      mainWindow.loadFile(path.join(__dirname, 'renderer', page));
    }
  }
});
