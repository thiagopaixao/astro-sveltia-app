const { app, BrowserWindow, ipcMain, Menu, dialog, BrowserView } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { spawn } = require('child_process');
const { rimraf } = require('rimraf');
const { execSync } = require('child_process');

let mainWindow;
let editorView;
let viewerView;
let globalDevServerUrl = null; // Global variable to store dev server URL
let activeProcesses = {}; // To keep track of running child processes

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: false, // Don't show until maximized
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Maximize the window before showing
  mainWindow.maximize();
  mainWindow.show();

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
        repoFolderName TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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

  ipcMain.handle('get-recent-projects', async () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT id, projectName, projectPath, repoFolderName FROM projects ORDER BY createdAt DESC LIMIT 3`, (err, rows) => {
        if (err) {
          console.error('Error getting recent projects:', err.message);
          reject(err.message);
        } else {
          resolve(rows);
        }
      });
    });
  });

  ipcMain.handle('getAllProjects', async () => {
    return new Promise((resolve, reject) => {
      console.log('Getting all projects from database...');
      db.all(`SELECT id, projectName, projectPath, repoFolderName, createdAt FROM projects ORDER BY createdAt DESC`, (err, rows) => {
        if (err) {
          console.error('Error getting all projects:', err.message);
          reject(err.message);
        } else {
          console.log(`Found ${rows.length} projects`);
          resolve(rows);
        }
      });
    });
  });

  ipcMain.handle('checkProjectExists', async (event, folderPath) => {
    return new Promise((resolve, reject) => {
      // Check if folder exists
      if (!fs.existsSync(folderPath)) {
        reject('Pasta não encontrada');
        return;
      }

      // Check if this path matches any existing project
      db.all(`SELECT id, projectName, projectPath, repoFolderName FROM projects`, (err, rows) => {
        if (err) {
          reject(err.message);
          return;
        }

        let matchingProject = null;
        for (const project of rows) {
          const fullProjectPath = path.join(project.projectPath, project.repoFolderName || '');
          if (fullProjectPath === folderPath) {
            matchingProject = project;
            break;
          }
        }

        if (matchingProject) {
          resolve({ exists: true, projectId: matchingProject.id });
        } else {
          // Get folder info
          const folderInfo = getFolderInfo(folderPath);
          resolve({ exists: false, folderInfo });
        }
      });
    });
  });

  ipcMain.handle('getFolderInfo', async (event, folderPath) => {
    return new Promise((resolve, reject) => {
      try {
        const folderInfo = getFolderInfo(folderPath);
        resolve(folderInfo);
      } catch (error) {
        reject(error.message);
      }
    });
  });

  // Helper function to get folder information
  function getFolderInfo(folderPath) {
    try {
      if (!fs.existsSync(folderPath)) {
        throw new Error('Pasta não encontrada');
      }

      const stats = fs.statSync(folderPath);
      if (!stats.isDirectory()) {
        throw new Error('Caminho não é uma pasta');
      }

      const files = fs.readdirSync(folderPath);
      const isEmpty = files.length === 0;

      let isGitRepo = false;
      let remoteUrl = null;

      // Check if it's a git repository
      const gitPath = path.join(folderPath, '.git');
      if (fs.existsSync(gitPath)) {
        isGitRepo = true;
        try {
          // Get remote URL
          const gitRemote = execSync('git remote get-url origin', { 
            cwd: folderPath, 
            encoding: 'utf8' 
          }).trim();
          remoteUrl = gitRemote;
        } catch (error) {
          console.log('Could not get git remote URL:', error.message);
        }
      }

      return {
        isEmpty,
        isGitRepo,
        remoteUrl,
        fileCount: files.length
      };
    } catch (error) {
      throw new Error(`Erro ao analisar pasta: ${error.message}`);
    }
  }

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

  ipcMain.handle('reopen-project', async (event, projectId, projectPath, githubUrl, repoFolderName) => {
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
      // For empty folders that were cloned directly, repoFolderName might be the folder name itself
      let repoDirPath;
      if (repoFolderName && fs.existsSync(path.join(projectPath, repoFolderName))) {
        repoDirPath = path.join(projectPath, repoFolderName);
      } else {
        // Check if projectPath itself is the repo (for empty folder case)
        if (fs.existsSync(path.join(projectPath, '.git'))) {
          repoDirPath = projectPath;
        } else {
          throw new Error('Repository folder not found');
        }
      }

      // Step 4: npm run build
      sendOutput('Construindo projeto...\n');
      await executeCommand('npm', ['run', 'build'], repoDirPath, `reopen-${projectId}`);
      sendOutput('Projeto construído.\n');
      sendStatus('success');
      await delay(3000);

      // Step 5: npm run dev (keep in background)
      sendOutput('Iniciando servidor de desenvolvimento...\n');
      const devProcess = spawn('npm', ['run', 'dev'], { cwd: repoDirPath });
      activeProcesses[`dev-reopen-${projectId}`] = devProcess;

      devProcess.stdout.on('data', (data) => {
        sendOutput(data.toString());
      });

      devProcess.stderr.on('data', (data) => {
        sendOutput(data.toString());
      });

      devProcess.on('close', (code) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        if (code !== 0) {
          sendOutput(`Servidor de desenvolvimento encerrado com código ${code}\n`);
          sendStatus('failure');
        }
      });

      let serverReady = false;
      const checkServerReady = (data) => {
        if (!serverReady && (data.includes('ready') || data.includes('compiled successfully') || data.includes('listening on'))) {
          serverReady = true;
          sendOutput('Servidor de desenvolvimento está pronto.\n');
          sendStatus('success');
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
            globalDevServerUrl = devServerUrl;
            console.log(`URL do servidor de desenvolvimento: ${devServerUrl}`);
            mainWindow.webContents.send('dev-server-url', devServerUrl);
          }
        }
      };

      devProcess.stdout.on('data', processOutput);
      devProcess.stderr.on('data', processOutput);

      devProcess.on('close', (code) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        if (code !== 0) {
          sendOutput(`Servidor de desenvolvimento encerrado com código ${code}\n`);
          sendStatus('failure');
        } else if (!serverReady) {
          sendOutput('Servidor de desenvolvimento encerrado sem sinalizar prontidão.\n');
          sendStatus('failure');
        }
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        sendOutput(`Falha ao iniciar servidor de desenvolvimento: ${err.message}\n`);
        sendStatus('failure');
      });

      sendOutput('Servidor de desenvolvimento iniciado em segundo plano. Aguardando sinal de prontidão...\n');
    } catch (error) {
      sendOutput(`Erro durante a reabertura do projeto: ${error}\n`);
      sendStatus('failure');
    }
  });

  ipcMain.handle('start-project-creation', async (event, projectId, projectPath, githubUrl, isExistingGitRepo = false, isEmptyFolder = false) => {
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
      let repoDirPath;
      
      if (isExistingGitRepo) {
        // Use existing folder
        repoDirPath = projectPath;
        const folderName = path.basename(projectPath);
        
        // Update repoFolderName in DB
        await new Promise((resolve, reject) => {
          db.run(`UPDATE projects SET repoFolderName = ? WHERE id = ?`, [folderName, projectId], (err) => {
            if (err) {
              console.error('Error updating repoFolderName:', err.message);
              reject(err.message);
            } else {
              console.log(`repoFolderName updated for project ${projectId}`);
              resolve();
            }
          });
        });
        
        sendOutput(`Using existing repository at ${repoDirPath}\n`);
        sendStatus('success');
        await delay(3000);
      } else if (isEmptyFolder) {
        // Clone directly into the empty folder
        repoDirPath = projectPath;
        const folderName = path.basename(projectPath);
        
        sendOutput('Cloning repository directly into selected folder...\n');
        await executeCommand('git', ['clone', githubUrl, '.'], repoDirPath, projectId);
        sendOutput(`Repository cloned into ${repoDirPath}\n`);
        sendStatus('success');
        await delay(3000);

        // Update repoFolderName in DB
        await new Promise((resolve, reject) => {
          db.run(`UPDATE projects SET repoFolderName = ? WHERE id = ?`, [folderName, projectId], (err) => {
            if (err) {
              console.error('Error updating repoFolderName:', err.message);
              reject(err.message);
            } else {
              console.log(`repoFolderName updated for project ${projectId}`);
              resolve();
            }
          });
        });
      } else {
        // Step 1: git clone (create subfolder)
        sendOutput('Cloning repository...\n');
        const repoName = githubUrl.split('/').pop().replace('.git', '');
        let finalRepoFolderName = repoName;
        let counter = 0;
        while (fs.existsSync(path.join(projectPath, finalRepoFolderName))) {
          counter++;
          finalRepoFolderName = `${repoName}-${counter}`;
        }
        repoDirPath = path.join(projectPath, finalRepoFolderName);

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
      }

      // Step 2: git checkout preview (skip if existing git repo)
      if (!isExistingGitRepo) {
        sendOutput('Checking out preview branch...\n');
        await executeCommand('git', ['checkout', 'preview'], repoDirPath, projectId);
        sendOutput('Checked out preview branch.\n');
        sendStatus('success');
        await delay(3000);
      } else {
        sendOutput('Skipping checkout for existing repository.\n');
        sendStatus('success');
        await delay(3000);
      }

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
            globalDevServerUrl = devServerUrl; // Store globally
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



  ipcMain.handle('remove-project', async (event, projectId) => {
    return new Promise((resolve, reject) => {
      console.log('Removing project:', projectId);
      
      // Get project details first
      db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
        if (err) {
          console.error('Error fetching project details:', err.message);
          reject(err.message);
          return;
        }

        if (!row) {
          reject('Project not found');
          return;
        }

        // Delete project from database first
        db.run('DELETE FROM projects WHERE id = ?', [projectId], function(err) {
          if (err) {
            console.error('Error deleting project from database:', err.message);
            reject(err.message);
            return;
          }

          console.log(`Project ${projectId} deleted from database.`);

          // Try to delete the folder (but don't fail if it doesn't work)
          if (row.repoFolderName && row.projectPath) {
            const repoDirPath = path.join(row.projectPath, row.repoFolderName);
            if (fs.existsSync(repoDirPath)) {
              try {
                fs.rmSync(repoDirPath, { recursive: true, force: true });
                console.log(`Repository folder ${repoDirPath} deleted.`);
              } catch (err) {
                console.error(`Error deleting repository folder ${repoDirPath}: ${err.message}`);
                // Don't reject - the project was removed from DB
              }
            }
          }

          resolve({ success: true });
        });
      });
    });
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
      }

      const trackBrowserViewLoad = (view, viewName) => {
        if (!view || !view.webContents || view.webContents.isDestroyed()) {
          return;
        }
        view.webContents.once('did-finish-load', () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            const currentUrl = view.webContents.getURL();
            mainWindow.webContents.send('browser-view-loaded', { viewName, url: currentUrl });
          }
        });
      };

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
          trackBrowserViewLoad(view, viewName);
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

      ipcMain.handle('set-all-browser-view-visibility', (event, visible) => {
        if (editorView) {
          if (visible) {
            mainWindow.addBrowserView(editorView);
          } else {
            mainWindow.removeBrowserView(editorView);
          }
        }
        if (viewerView) {
          if (visible) {
            mainWindow.addBrowserView(viewerView);
          } else {
            mainWindow.removeBrowserView(viewerView);
          }
        }
      });

      ipcMain.handle('get-dev-server-url-from-main', () => {
        return globalDevServerUrl;
      });

      ipcMain.handle('capture-browser-view-page', async (event, viewName) => {
        const view = viewName === 'editor' ? editorView : viewerView;
        if (view) {
          try {
            const image = await view.webContents.capturePage();
            return image.toDataURL(); // Convert NativeImage to base64 data URL
          } catch (error) {
            console.error(`Error capturing page for ${viewName} view:`, error);
            return null;
          }
        }
        return null;
      });

      ipcMain.handle('browser-view-go-back', (event, viewName) => {
        const view = viewName === 'editor' ? editorView : viewerView;
        if (view && !view.webContents.isDestroyed() && view.webContents.canGoBack()) {
          trackBrowserViewLoad(view, viewName);
          view.webContents.goBack();
          return true;
        }
        return false;
      });

      ipcMain.handle('browser-view-reload', (event, viewName) => {
        const view = viewName === 'editor' ? editorView : viewerView;
        if (view && !view.webContents.isDestroyed()) {
          trackBrowserViewLoad(view, viewName);
          view.webContents.reload();
          return true;
        }
        return false;
      });

      ipcMain.handle('get-browser-view-url', (event, viewName) => {
        const view = viewName === 'editor' ? editorView : viewerView;
        if (view && !view.webContents.isDestroyed()) {
          return view.webContents.getURL();
        }
        return null;
      });

      ipcMain.handle('clear-browser-cache', async () => {
        try {
          const clearViewCache = async (view) => {
            if (view && !view.webContents.isDestroyed()) {
              // Clear cache
              await view.webContents.session.clearCache();
              // Clear storage data (cookies, localStorage, sessionStorage, etc.)
              await view.webContents.session.clearStorageData({
                storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
              });
              // Clear navigation history
              view.webContents.clearHistory();
            }
          };

          // Clear cache for both BrowserViews
          await Promise.all([
            clearViewCache(editorView),
            clearViewCache(viewerView)
          ]);

          return { success: true };
        } catch (error) {
          console.error('Error clearing browser cache:', error);
          return { success: false, error: error.message };
        }
      });

    } else {
      // For other pages (like create.html), destroy BrowserViews
      destroyBrowserViews();
      mainWindow.loadFile(path.join(__dirname, 'renderer', page));
    }
  }
});
