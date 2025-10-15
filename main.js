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

// Store BrowserViews per window for independent control
const windowBrowserViews = new Map(); // windowId -> { editorView, viewerView }

// Flag to prevent multiple cleanup attempts
let isCleaningUp = false;

// Reset cleanup flag when app starts
app.on('ready', async () => {
  isCleaningUp = false;
  console.log('🚀 App ready - cleanup flag reset');
  
  // Clean up any orphaned processes from previous runs
  await cleanupOrphanedProcesses();
});

// Function to clean up orphaned processes from previous runs
async function cleanupOrphanedProcesses() {
  console.log('🧹 Checking for orphaned processes from previous runs...');
  
  // If we have a global dev server URL stored, try to kill any process on that port
  if (globalDevServerUrl) {
    const port = extractPortFromUrl(globalDevServerUrl);
    if (port) {
      console.log(`🔍 Checking for orphaned process on port ${port}...`);
      await killProcessByPort(port);
    }
  }
  
  // Also check common development ports (3000-3010, 4320-4330)
  const commonPorts = [];
  for (let i = 3000; i <= 3010; i++) commonPorts.push(i);
  for (let i = 4320; i <= 4330; i++) commonPorts.push(i);
  
  console.log('🔍 Checking common development ports for orphaned processes...');
  for (const port of commonPorts) {
    await killProcessByPort(port);
  }
  
  console.log('✅ Orphaned process cleanup completed');
}

// Function to check if a process is still alive
function isProcessAlive(process) {
  try {
    // Signal 0 doesn't kill the process, just checks if it exists
    process.kill(0);
    return true;
  } catch (error) {
    return false;
  }
}

// Function to kill a single process with verification
async function killProcess(processId, process) {
  if (!process) {
    console.log(`✅ Process ${processId} not found, skipping`);
    return true;
  }

  const pid = process.pid || 'unknown';
  console.log(`🔪 Attempting to kill process: ${processId} (PID: ${pid})`);
  
  try {
    // First attempt: SIGTERM (graceful shutdown)
    process.kill('SIGTERM');
    console.log(`📤 Sent SIGTERM to process ${processId} (PID: ${pid})`);
    
    // Wait 2 seconds and check if it's still alive
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (isProcessAlive(process)) {
      console.log(`⚠️  Process ${processId} (PID: ${pid}) still alive after SIGTERM, trying SIGKILL`);
      
      // Second attempt: SIGKILL (force kill)
      process.kill('SIGKILL');
      console.log(`📤 Sent SIGKILL to process ${processId} (PID: ${pid})`);
      
      // Wait another 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (isProcessAlive(process)) {
        console.log(`❌ Process ${processId} (PID: ${pid}) still alive after SIGKILL!`);
        return false;
      } else {
        console.log(`✅ Process ${processId} (PID: ${pid}) killed with SIGKILL`);
        return true;
      }
    } else {
      console.log(`✅ Process ${processId} (PID: ${pid}) killed with SIGTERM`);
      return true;
    }
  } catch (error) {
    console.log(`❌ Error killing process ${processId} (PID: ${pid}):`, error.message);
    return false;
  }
}

// Function to kill process by port (fallback method)
async function killProcessByPort(port) {
  console.log(`🔍 Attempting to kill process using port ${port}`);
  
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    if (process.platform === 'win32') {
      // Windows: use netstat + taskkill
      const netstat = spawn('netstat', ['-ano']);
      let output = '';
      
      netstat.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      netstat.on('close', () => {
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes(`:${port}`) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              console.log(`🔪 Found process ${pid} using port ${port}, killing...`);
              spawn('taskkill', ['/F', '/PID', pid]);
            }
          }
        }
        resolve();
      });
    } else {
      // Unix-like: use lsof
      const lsof = spawn('lsof', ['-ti', `:${port}`]);
      let output = '';
      
      lsof.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      lsof.on('close', () => {
        const pids = output.trim().split('\n').filter(pid => pid);
        for (const pid of pids) {
          console.log(`🔪 Found process ${pid} using port ${port}, killing...`);
          spawn('kill', ['-9', pid]);
        }
        resolve();
      });
    }
  });
}

// Function to extract port from URL
function extractPortFromUrl(url) {
  const match = url.match(/http:\/\/localhost:(\d+)\//);
  return match ? parseInt(match[1]) : null;
}

// Function to kill all active processes
async function killAllActiveProcesses() {
  if (isCleaningUp) {
    console.log('⚠️  Cleanup already in progress, skipping...');
    return;
  }
  
  isCleaningUp = true;
  const processIds = Object.keys(activeProcesses);
  console.log(`🔄 Killing all active processes... Found ${processIds.length} processes:`, processIds);
  
  if (processIds.length === 0) {
    console.log('✅ No active processes to kill');
    return;
  }
  
  // Store URLs for fallback port killing
  const urlsToKill = [];
  
  // Kill all registered processes
  const killPromises = processIds.map(async (processId) => {
    const process = activeProcesses[processId];
    
    // Store URL for fallback if it's a dev server
    if (processId.includes('dev-') && globalDevServerUrl) {
      urlsToKill.push(globalDevServerUrl);
    }
    
    const success = await killProcess(processId, process);
    delete activeProcesses[processId];
    return success;
  });
  
  // Wait for all kills to complete
  const results = await Promise.all(killPromises);
  const successCount = results.filter(r => r).length;
  const failCount = results.length - successCount;
  
  console.log(`📊 Kill results: ${successCount} successful, ${failCount} failed`);
  
  // Fallback: kill by port if any processes failed
  if (failCount > 0 || urlsToKill.length > 0) {
    console.log('🔄 Using fallback method: killing by port...');
    
    for (const url of urlsToKill) {
      const port = extractPortFromUrl(url);
      if (port) {
        await killProcessByPort(port);
      }
    }
  }
  
  console.log('✅ All active processes killed (or attempted)');
}

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
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('command-output', output);
        }
      });
    };

    const sendStatus = (status) => {
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('command-status', status);
        }
      });
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
            // Send to all windows for synchronization
            const allWindows = BrowserWindow.getAllWindows();
            console.log(`📡 Sending dev-server-url to ${allWindows.length} windows`);
            BrowserWindow.getAllWindows().forEach(window => {
              if (!window.isDestroyed()) {
                console.log(`📡 Sending to window: ${window.id}`);
                window.webContents.send('dev-server-url', devServerUrl);
              }
            });
          }
        }
      };

      const devProcess = spawn('npm', ['run', 'dev'], { cwd: repoDirPath });
      activeProcesses[`dev-reopen-${projectId}`] = devProcess;

      devProcess.stdout.on('data', processOutput);
      devProcess.stderr.on('data', processOutput);

      devProcess.on('close', (code) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        if (code !== 0) {
          sendOutput(`Servidor de desenvolvimento encerrado com código ${code}\n`);
          sendStatus('failure');
        }
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        sendOutput(`Falha ao iniciar servidor de desenvolvimento: ${err.message}\n`);
        sendStatus('failure');
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
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('command-output', output);
        }
      });
    };

    const sendStatus = (status) => {
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('command-status', status);
        }
      });
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
            // Send to all windows for synchronization
            const allWindows = BrowserWindow.getAllWindows();
            console.log(`📡 Sending dev-server-url to ${allWindows.length} windows`);
            BrowserWindow.getAllWindows().forEach(window => {
              if (!window.isDestroyed()) {
                console.log(`📡 Sending to window: ${window.id}`);
                window.webContents.send('dev-server-url', devServerUrl);
              }
            });
          }
        }
      };

      const devProcess = spawn('npm', ['run', 'dev'], { cwd: repoDirPath });
      activeProcesses[`dev-${projectId}`] = devProcess;

      devProcess.stdout.on('data', processOutput);
      devProcess.stderr.on('data', processOutput);

      devProcess.on('close', (code) => {
        delete activeProcesses[`dev-${projectId}`];
        if (code !== 0) {
          sendOutput(`Development server exited with code ${code}\n`);
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
          // Send to all windows for synchronization
          BrowserWindow.getAllWindows().forEach(window => {
            if (!window.isDestroyed()) {
              window.webContents.send('command-output', `Repository folder ${repoDirPath} deleted.\n`);
            }
          });
        } catch (err) {
          // Send to all windows for synchronization
          BrowserWindow.getAllWindows().forEach(window => {
            if (!window.isDestroyed()) {
              window.webContents.send('command-output', `Error deleting repository folder ${repoDirPath}: ${err.message}\n`);
            }
          });
        }
      }
    }
    
    // Send to all windows for synchronization
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('command-status', 'cancelled');
      }
    });
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

// Handle app quit event - kill all processes before quitting
app.on('before-quit', async (event) => {
  console.log('🚪 App is quitting - killing all processes...');
  try {
    await killAllActiveProcesses();
    console.log('✅ All processes killed successfully');
  } catch (error) {
    console.error('❌ Error killing processes:', error);
  }
});

app.on('window-all-closed', () => {
  // Clean up BrowserViews when all windows are closed
  windowBrowserViews.clear();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up BrowserViews when individual windows are closed
app.on('window-closed', (event, window) => {
  const windowId = window.id;
  if (windowBrowserViews.has(windowId)) {
    const views = windowBrowserViews.get(windowId);
    // Clean up BrowserViews
    if (views.editorView && !views.editorView.webContents.isDestroyed()) {
      views.editorView.webContents.close();
    }
    if (views.viewerView && !views.viewerView.webContents.isDestroyed()) {
      views.viewerView.webContents.close();
    }
    windowBrowserViews.delete(windowId);
    console.log(`Cleaned up BrowserViews for window ${windowId}`);
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

      const trackBrowserViewLoad = (view, viewName, targetWindow = null) => {
        if (!view || !view.webContents || view.webContents.isDestroyed()) {
          return;
        }
        
        console.log(`🎯 Setting up load tracking for ${viewName} BrowserView`);
        
        let hasFired = false;
        const fireLoadedEvent = () => {
          if (hasFired) return;
          hasFired = true;
          
          const window = targetWindow || mainWindow;
          if (window && !window.isDestroyed()) {
            const currentUrl = view.webContents.getURL();
            console.log(`✅ ${viewName} BrowserView loaded successfully: ${currentUrl}`);
            // Send to all windows for synchronization
            broadcastToAllWindows('browser-view-loaded', { viewName, url: currentUrl });
          }
        };

        // Try multiple events to ensure loading is detected
        view.webContents.once('did-finish-load', () => {
          console.log(`📄 ${viewName} did-finish-load fired`);
          // Add a small delay to ensure content is ready
          setTimeout(fireLoadedEvent, 100);
        });
        
        view.webContents.once('dom-content-loaded', () => {
          console.log(`🌳 ${viewName} dom-content-loaded fired`);
          setTimeout(fireLoadedEvent, 200);
        });
        
        // Fallback timeout to prevent loading from getting stuck
        setTimeout(() => {
          if (!hasFired) {
            console.log(`⏰ ${viewName} loading timeout - firing anyway`);
            fireLoadedEvent();
          }
        }, 5000);
      };

      // IPC handlers for BrowserView control
      ipcMain.handle('set-browser-view-bounds', (event, viewName, bounds) => {
        const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
        const view = viewName === 'editor' ? ev : vv;
        const window = BrowserWindow.fromWebContents(event.sender);
        if (view && window) {
          view.setBounds(bounds);
        }
      });

      ipcMain.handle('load-browser-view-url', (event, viewName, url) => {
        const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
        const window = BrowserWindow.fromWebContents(event.sender);
        const view = viewName === 'editor' ? ev : vv;
        if (view) {
          console.log(`🔗 Loading ${viewName} BrowserView with URL: ${url}`);
          trackBrowserViewLoad(view, viewName, window);
          view.webContents.loadURL(url);
        } else {
          console.log(`❌ BrowserView not found for ${viewName}`);
        }
      });

      ipcMain.handle('set-browser-view-visibility', (event, viewName, visible) => {
        const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
        const view = viewName === 'editor' ? ev : vv;
        const window = BrowserWindow.fromWebContents(event.sender);
        if (view && window) {
          if (visible) {
            window.addBrowserView(view);
          } else {
            window.removeBrowserView(view);
          }
        }
      });

      ipcMain.handle('set-all-browser-view-visibility', (event, visible) => {
        const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
        const window = BrowserWindow.fromWebContents(event.sender);
        if (ev && window) {
          if (visible) {
            window.addBrowserView(ev);
          } else {
            window.removeBrowserView(ev);
          }
        }
        if (vv && window) {
          if (visible) {
            window.addBrowserView(vv);
          } else {
            window.removeBrowserView(vv);
          }
        }
      });

ipcMain.handle('get-dev-server-url-from-main', () => {
    console.log('📡 get-dev-server-url-from-main called, returning:', globalDevServerUrl);
    return globalDevServerUrl;
  });

  // Handle exit confirmation from renderer
  ipcMain.handle('confirm-exit-app', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    console.log('🚪 Exit confirmation requested from window:', window?.id);
    
    return new Promise((resolve) => {
      if (window && !window.isDestroyed()) {
        // Send request to renderer to show confirmation dialog
        console.log('📤 Sending show-exit-confirmation to renderer');
        window.webContents.send('show-exit-confirmation');
        
        // Listen for response
        const handleResponse = (event, confirmed) => {
          ipcMain.removeListener('exit-confirmation-response', handleResponse);
          console.log('🚪 Exit confirmation response received:', confirmed);
          
          if (confirmed) {
            console.log('🚪 User confirmed exit - killing processes and quitting');
            
            // Kill processes first (async)
            killAllActiveProcesses().then(() => {
              console.log('🚪 Processes killed, now quitting app');
              app.quit();
            }).catch((error) => {
              console.error('❌ Error killing processes:', error);
              app.quit(); // Quit anyway even if kill fails
            });
            
            // Fallback: force exit if app.quit() doesn't work within 5 seconds
            setTimeout(() => {
              console.log('🚪 Forcing exit after timeout...');
              process.exit(0);
            }, 5000);
          } else {
            console.log('🚪 User cancelled exit');
          }
          
          resolve(confirmed);
        };
        
        ipcMain.once('exit-confirmation-response', handleResponse);
        
        // Timeout after 30 seconds (user didn't respond)
        setTimeout(() => {
          ipcMain.removeListener('exit-confirmation-response', handleResponse);
          console.log('🚪 Exit confirmation timeout - cancelling exit');
          resolve(false);
        }, 30000);
      } else {
        console.log('❌ Window not found or destroyed');
        resolve(false);
      }
    });
  });



  // Function to broadcast events to all windows
  function broadcastToAllWindows(channel, ...args) {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, ...args);
      }
    });
  }

  // Function to get or create BrowserViews for a specific window
  function getOrCreateBrowserViews(window) {
    const windowId = window.id;
    
    if (!windowBrowserViews.has(windowId)) {
      // Create new BrowserViews for this window
      const newEditorView = new BrowserView({
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: false,
          enableRemoteModule: false,
        }
      });
      
      const newViewerView = new BrowserView({
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: false,
          enableRemoteModule: false,
        }
      });
      
      // Initialize with blank pages and hide
      newEditorView.webContents.loadURL('about:blank');
      newEditorView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      window.addBrowserView(newEditorView);
      
      newViewerView.webContents.loadURL('about:blank');
      newViewerView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      window.addBrowserView(newViewerView);
      
      windowBrowserViews.set(windowId, {
        editorView: newEditorView,
        viewerView: newViewerView
      });
      
      console.log(`Created new BrowserViews for window ${windowId}`);
    }
    
    return windowBrowserViews.get(windowId);
  }

  // Function to get BrowserViews for the window that sent the IPC event
  function getBrowserViewsForEvent(event) {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      // Fallback to main window for backward compatibility
      return { editorView, viewerView };
    }
    return getOrCreateBrowserViews(window);
  }

      ipcMain.handle('capture-browser-view-page', async (event, viewName) => {
        const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
        const view = viewName === 'editor' ? ev : vv;
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
        const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
        const window = BrowserWindow.fromWebContents(event.sender);
        const view = viewName === 'editor' ? ev : vv;
        if (view && !view.webContents.isDestroyed() && view.webContents.canGoBack()) {
          trackBrowserViewLoad(view, viewName, window);
          view.webContents.goBack();
          return true;
        }
        return false;
      });

      ipcMain.handle('browser-view-reload', (event, viewName) => {
        const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
        const window = BrowserWindow.fromWebContents(event.sender);
        const view = viewName === 'editor' ? ev : vv;
        if (view && !view.webContents.isDestroyed()) {
          trackBrowserViewLoad(view, viewName, window);
          view.webContents.reload();
          return true;
        }
        return false;
      });

      ipcMain.handle('get-browser-view-url', (event, viewName) => {
        const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
        const view = viewName === 'editor' ? ev : vv;
        if (view && !view.webContents.isDestroyed()) {
          return view.webContents.getURL();
        }
        return null;
      });

      ipcMain.handle('clear-browser-cache', async (event) => {
        try {
          const { editorView: ev, viewerView: vv } = getBrowserViewsForEvent(event);
          
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

          // Clear cache for both BrowserViews of the calling window
          await Promise.all([
            clearViewCache(ev),
            clearViewCache(vv)
          ]);

          return { success: true };
        } catch (error) {
          console.error('Error clearing browser cache:', error);
          return { success: false, error: error.message };
        }
      });

      ipcMain.handle('create-new-window-with-state', async (event, windowState) => {
        try {
          console.log('Creating new window with state:', windowState);
          
          // Validate window state before proceeding
          if (!windowState || typeof windowState !== 'object') {
            throw new Error('Invalid window state provided');
          }
          
          // Create new window with same configuration as main window
          const newWindow = new BrowserWindow({
            width: 900,
            height: 600,
            show: false,
            webPreferences: {
              preload: path.join(__dirname, 'preload.js'),
              contextIsolation: true,
              nodeIntegration: false
            }
          });

          // Maximize and show the new window
          newWindow.maximize();
          newWindow.show();

          // Encode window state as base64 for URL parameter
          const encodedState = Buffer.from(JSON.stringify(windowState)).toString('base64');
          const mainHtmlPath = path.join(__dirname, 'renderer', 'main.html');
          
          console.log('Loading new window with encoded state length:', encodedState.length);
          
          // Load main.html with state parameters
          newWindow.loadFile(mainHtmlPath, {
            query: { state: encodedState }
          });

          // Hide the menu bar for new window
          Menu.setApplicationMenu(null);

          console.log('New window created successfully');
          return { success: true };
        } catch (error) {
          console.error('Error creating new window:', error);
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
