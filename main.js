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

// Secure process tracking for Documental only
let activeDocumentalProcesses = {}; // { pid: { pid, port, projectId, startTime, command, cwd } }
const PROCESSES_FILE = path.join(app.getPath('userData'), 'documental-processes.json');

// Functions to persist Documental processes
function loadDocumentalProcesses() {
  try {
    if (fs.existsSync(PROCESSES_FILE)) {
      const data = fs.readFileSync(PROCESSES_FILE, 'utf8');
      const processes = JSON.parse(data);
      console.log('📂 Loaded Documental processes from file:', Object.keys(processes));
      return processes;
    }
  } catch (error) {
    console.error('Error loading Documental processes:', error);
  }
  return {};
}

function saveDocumentalProcesses() {
  try {
    fs.writeFileSync(PROCESSES_FILE, JSON.stringify(activeDocumentalProcesses, null, 2));
    console.log('💾 Saved Documental processes to file');
  } catch (error) {
    console.error('Error saving Documental processes:', error);
  }
}

function addDocumentalProcess(pid, processInfo) {
  activeDocumentalProcesses[pid] = {
    pid,
    port: processInfo.port,
    projectId: processInfo.projectId,
    startTime: Date.now(),
    command: processInfo.command,
    cwd: processInfo.cwd
  };
  saveDocumentalProcesses();
  console.log(`➕ Added Documental process to tracking: PID ${pid}, Port ${processInfo.port}`);
}

function removeDocumentalProcess(pid) {
  if (activeDocumentalProcesses[pid]) {
    delete activeDocumentalProcesses[pid];
    saveDocumentalProcesses();
    console.log(`➖ Removed Documental process from tracking: PID ${pid}`);
  }
}

// Reset cleanup flag when app starts
app.on('ready', async () => {
  isCleaningUp = false;
  console.log('🚀 App ready - cleanup flag reset');
  
  // Load previously tracked Documental processes
  activeDocumentalProcesses = loadDocumentalProcesses();
  
  // Clean up only Documental orphaned processes from previous runs
  await cleanupDocumentalOrphanedProcesses();
});

// Function to check if a process belongs to Documental
async function isDocumentalProcess(pid, expectedPort = null) {
  try {
    if (process.platform === 'win32') {
      // Windows: Use tasklist to get process info
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const tasklist = spawn('tasklist', ['/fi', `PID eq ${pid}`, '/fo', 'csv', '/v']);
        let output = '';
        
        tasklist.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        tasklist.on('close', () => {
          const lines = output.split('\n');
          if (lines.length > 1) {
            const processLine = lines[1];
            // Check if it's node.exe and has Documental-related command
            if (processLine.includes('node.exe')) {
              // Get command line arguments
              const wmic = spawn('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'CommandLine', '/value']);
              let cmdOutput = '';
              
              wmic.stdout.on('data', (data) => {
                cmdOutput += data.toString();
              });
              
              wmic.on('close', () => {
                const isDocumental = cmdOutput.includes('npm run dev') || 
                                   cmdOutput.includes('documental') ||
                                   cmdOutput.includes('astro');
                console.log(`🔍 Windows process ${pid} cmdline check: ${isDocumental}`);
                console.log(`   Command line: ${cmdOutput.substring(0, 200)}...`);
                resolve(isDocumental);
              });
            } else {
              console.log(`🔍 Windows process ${pid} is not node.exe`);
              resolve(false);
            }
          } else {
            console.log(`🔍 Windows process ${pid} not found in tasklist`);
            resolve(false);
          }
        });
      });
    } else {
      // Linux/Mac: Use /proc filesystem
      if (!fs.existsSync(`/proc/${pid}`)) {
        console.log(`🔍 Process ${pid} does not exist in /proc`);
        return false;
      }
      
      try {
        // Read command line
        const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
        const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
        
        console.log(`🔍 Linux process ${pid} analysis:`);
        console.log(`   Command line: ${cmdline}`);
        console.log(`   Working directory: ${cwd}`);
        
        // Check if it's a Node.js process related to Documental
        const isNodeProcess = cmdline.includes('node');
        const hasNpmDev = cmdline.includes('npm run dev') || cmdline.includes('npm start');
        const isDocumentalRelated = cmdline.includes('documental') || 
                                  cmdline.includes('astro') ||
                                  cwd.includes('documental');
        
        // Consider it Documental if it has npm run dev OR is Node.js + Documental-related
        const isDocumental = hasNpmDev || (isNodeProcess && isDocumentalRelated);
        
        console.log(`   Node process: ${isNodeProcess}`);
        console.log(`   Has npm dev: ${hasNpmDev}`);
        console.log(`   Documental related: ${isDocumentalRelated}`);
        console.log(`   Final result: ${isDocumental}`);
        
        return isDocumental;
      } catch (error) {
        console.log(`Error checking process ${pid}:`, error.message);
        return false;
      }
    }
  } catch (error) {
    console.log(`Error checking if process ${pid} is Documental:`, error.message);
    return false;
  }
}

// Function to clean up only Documental orphaned processes from previous runs
async function cleanupDocumentalOrphanedProcesses() {
  console.log('🧹 Checking for Documental orphaned processes from previous runs...');
  
  const trackedProcesses = Object.values(activeDocumentalProcesses);
  if (trackedProcesses.length === 0) {
    console.log('📂 No previously tracked Documental processes found');
    return;
  }
  
  console.log(`📂 Found ${trackedProcesses.length} previously tracked Documental processes`);
  
  for (const processInfo of trackedProcesses) {
    const { pid, port, projectId, command, cwd } = processInfo;
    
    console.log(`🔍 Checking tracked process: PID ${pid}, Port ${port}, Project ${projectId}, Command ${command}`);
    
    // Check if process is still running
    const isRunning = await isProcessRunning(pid);
    console.log(`📊 Process ${pid} is running: ${isRunning}`);
    
    if (isRunning) {
      // Check if it belongs to Documental
      const isDocumental = await isDocumentalProcess(pid, port);
      console.log(`🎯 Process ${pid} is Documental: ${isDocumental}`);
      
      if (isDocumental) {
        console.log(`🔍 Found Documental orphaned process: PID ${pid} on port ${port} (Project: ${projectId})`);
        const killed = await killDocumentalProcess(pid, port);
        if (killed) {
          console.log(`✅ Successfully killed orphaned process ${pid}`);
        } else {
          console.log(`❌ Failed to kill orphaned process ${pid}`);
        }
      } else {
        console.log(`⚠️ Process ${pid} is running but not Documental, removing from tracking`);
        console.log(`   Process details: Command=${command}, CWD=${cwd}`);
        removeDocumentalProcess(pid);
      }
    } else {
      console.log(`🗑️ Process ${pid} is not running, removing from tracking`);
      removeDocumentalProcess(pid);
    }
  }
  
  console.log('✅ Documental orphaned process cleanup completed');
}

// Function to check if a process is still running
async function isProcessRunning(pid) {
  try {
    if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const tasklist = spawn('tasklist', ['/fi', `PID eq ${pid}`, '/fo', 'csv']);
        let output = '';
        
        tasklist.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        tasklist.on('close', () => {
          resolve(output.includes(pid.toString()));
        });
      });
    } else {
      // Linux/Mac: Check if /proc/pid exists
      return fs.existsSync(`/proc/${pid}`);
    }
  } catch (error) {
    return false;
  }
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

// Function to kill only Documental processes by port
async function killDocumentalProcess(pid, port) {
  console.log(`🔍 Attempting to kill Documental process: PID ${pid} on port ${port}`);
  
  try {
    // First verify it's actually a Documental process
    const isDocumental = await isDocumentalProcess(pid, port);
    if (!isDocumental) {
      console.log(`⚠️ Process ${pid} is not a Documental process, skipping`);
      removeDocumentalProcess(pid);
      return false;
    }
    
    // Kill the process safely and wait for it to complete
    console.log(`🔪 Sending kill signal to process ${pid}...`);
    
    if (process.platform === 'win32') {
      await new Promise((resolve, reject) => {
        const taskkill = spawn('taskkill', ['/F', '/PID', pid]);
        taskkill.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ taskkill completed successfully for PID ${pid}`);
            resolve();
          } else {
            console.log(`⚠️ taskkill exited with code ${code} for PID ${pid}`);
            resolve(); // Still resolve, process might already be dead
          }
        });
        taskkill.on('error', (error) => {
          console.log(`⚠️ taskkill error for PID ${pid}:`, error.message);
          resolve(); // Still resolve, process might already be dead
        });
      });
    } else {
      await new Promise((resolve, reject) => {
        const kill = spawn('kill', ['-9', pid]);
        kill.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ kill completed successfully for PID ${pid}`);
            resolve();
          } else {
            console.log(`⚠️ kill exited with code ${code} for PID ${pid}`);
            resolve(); // Still resolve, process might already be dead
          }
        });
        kill.on('error', (error) => {
          console.log(`⚠️ kill error for PID ${pid}:`, error.message);
          resolve(); // Still resolve, process might already be dead
        });
      });
    }
    
    // Wait a moment for the process to actually die
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify the process is actually dead
    const isStillRunning = await isProcessRunning(pid);
    if (isStillRunning) {
      console.log(`⚠️ Process ${pid} is still running after kill attempt, trying alternative method...`);
      
      // Try alternative method
      if (process.platform === 'win32') {
        spawn('wmic', ['process', 'where', `ProcessId=${pid}`, 'delete']);
      } else {
        spawn('pkill', ['-f', `npm run dev`]);
      }
      
      // Wait again
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Final check
      const finalCheck = await isProcessRunning(pid);
      if (finalCheck) {
        console.log(`❌ Process ${pid} survived all kill attempts!`);
        return false;
      } else {
        console.log(`✅ Process ${pid} finally killed with alternative method`);
      }
    } else {
      console.log(`✅ Successfully killed Documental process ${pid}`);
    }
    
    // Only remove from tracking after confirming it's dead
    removeDocumentalProcess(pid);
    return true;
  } catch (error) {
    console.error(`❌ Error killing Documental process ${pid}:`, error.message);
    return false;
  }
}

// Function to kill process by port (only for Documental processes)
async function killProcessByPort(port) {
  console.log(`🔍 Checking for Documental processes using port ${port}`);
  
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    if (process.platform === 'win32') {
      // Windows: use netstat + taskkill
      const netstat = spawn('netstat', ['-ano']);
      let output = '';
      
      netstat.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      netstat.on('close', async () => {
        const lines = output.split('\n');
        let killedCount = 0;
        
        for (const line of lines) {
          if (line.includes(`:${port}`) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              const isDocumental = await isDocumentalProcess(parseInt(pid), port);
              if (isDocumental) {
                console.log(`🔪 Found Documental process ${pid} using port ${port}, killing...`);
                spawn('taskkill', ['/F', '/PID', pid]);
                killedCount++;
              } else {
                console.log(`⚠️ Process ${pid} on port ${port} is not Documental, skipping`);
              }
            }
          }
        }
        
        console.log(`✅ Killed ${killedCount} Documental processes on port ${port}`);
        resolve(killedCount);
      });
    } else {
      // Unix-like: use lsof
      const lsof = spawn('lsof', ['-ti', `:${port}`]);
      let output = '';
      
      lsof.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      lsof.on('close', async () => {
        const pids = output.trim().split('\n').filter(pid => pid);
        let killedCount = 0;
        
        for (const pidStr of pids) {
          const pid = parseInt(pidStr);
          const isDocumental = await isDocumentalProcess(pid, port);
          if (isDocumental) {
            console.log(`🔪 Found Documental process ${pid} using port ${port}, killing...`);
            spawn('kill', ['-9', pid]);
            killedCount++;
          } else {
            console.log(`⚠️ Process ${pid} on port ${port} is not Documental, skipping`);
          }
        }
        
        console.log(`✅ Killed ${killedCount} Documental processes on port ${port}`);
        resolve(killedCount);
      });
    }
  });
}

// Function to extract port from URL
function extractPortFromUrl(url) {
  const match = url.match(/http:\/\/localhost:(\d+)\//);
  return match ? parseInt(match[1]) : null;
}

// Function to kill all active Documental processes
async function killAllActiveProcesses() {
  if (isCleaningUp) {
    console.log('⚠️  Cleanup already in progress, skipping...');
    return;
  }
  
  isCleaningUp = true;
  const processIds = Object.keys(activeProcesses);
  console.log(`🔄 Killing all active Documental processes... Found ${processIds.length} processes:`, processIds);
  
  // First, kill tracked active processes
  if (processIds.length > 0) {
    const killPromises = processIds.map(async (processId) => {
      const process = activeProcesses[processId];
      const success = await killProcess(processId, process);
      delete activeProcesses[processId];
      return success;
    });
    
    const results = await Promise.all(killPromises);
    const successCount = results.filter(r => r).length;
    const failCount = results.length - successCount;
    
    console.log(`📊 Active process kill results: ${successCount} successful, ${failCount} failed`);
  } else {
    console.log('✅ No active processes to kill');
  }
  
  // Then, clean up any remaining tracked Documental processes
  const trackedProcesses = Object.values(activeDocumentalProcesses);
  if (trackedProcesses.length > 0) {
    console.log(`🔄 Cleaning up ${trackedProcesses.length} tracked Documental processes...`);
    
    for (const processInfo of trackedProcesses) {
      await killDocumentalProcess(processInfo.pid, processInfo.port);
    }
  }
  
  // Fallback: only kill by port if we have a global dev server URL
  if (globalDevServerUrl) {
    const port = extractPortFromUrl(globalDevServerUrl);
    if (port) {
      console.log('🔄 Using fallback method: killing Documental processes by port...');
      await killProcessByPort(port);
    }
  }
  
  console.log('✅ All Documental processes killed (or attempted)');
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
            
            // Extract port and update the tracked Documental process
            const port = extractPortFromUrl(devServerUrl);
            if (port && devProcess.pid) {
              // Update the process with port information
              if (activeDocumentalProcesses[devProcess.pid]) {
                activeDocumentalProcesses[devProcess.pid].port = port;
                saveDocumentalProcesses();
                console.log(`📝 Updated Documental process ${devProcess.pid} with port ${port}`);
              }
            }
            
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

      // Track this as a Documental process
      if (devProcess.pid) {
        addDocumentalProcess(devProcess.pid, {
          port: null, // Will be updated when URL is detected
          projectId: projectId,
          command: 'npm run dev',
          cwd: repoDirPath
        });
      }

      devProcess.stdout.on('data', processOutput);
      devProcess.stderr.on('data', processOutput);

      devProcess.on('close', (code) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
        if (code !== 0) {
          sendOutput(`Servidor de desenvolvimento encerrado com código ${code}\n`);
          sendStatus('failure');
        }
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
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
            
            // Extract port and update the tracked Documental process
            const port = extractPortFromUrl(devServerUrl);
            if (port && devProcess.pid) {
              // Update the process with port information
              if (activeDocumentalProcesses[devProcess.pid]) {
                activeDocumentalProcesses[devProcess.pid].port = port;
                saveDocumentalProcesses();
                console.log(`📝 Updated Documental process ${devProcess.pid} with port ${port}`);
              }
            }
            
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

      // Track this as a Documental process
      if (devProcess.pid) {
        addDocumentalProcess(devProcess.pid, {
          port: null, // Will be updated when URL is detected
          projectId: projectId,
          command: 'npm run dev',
          cwd: repoDirPath
        });
      }

      devProcess.stdout.on('data', processOutput);
      devProcess.stderr.on('data', processOutput);

      devProcess.on('close', (code) => {
        delete activeProcesses[`dev-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
        if (code !== 0) {
          sendOutput(`Development server exited with code ${code}\n`);
          sendStatus('failure');
        }
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
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
      const process = activeProcesses[projectId];
      if (process.pid) {
        removeDocumentalProcess(process.pid);
      }
      process.kill();
      delete activeProcesses[projectId];
    }
    if (activeProcesses[`dev-${projectId}`]) {
      const process = activeProcesses[`dev-${projectId}`];
      if (process.pid) {
        removeDocumentalProcess(process.pid);
      }
      process.kill();
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
        let domReady = false;
        let loadStopped = false;
        
        const fireLoadedEvent = () => {
          if (hasFired) return;
          
          // Only fire when both DOM is ready AND loading has stopped
          if (!domReady || !loadStopped) {
            console.log(`⏳ ${viewName} waiting for both events - DOM: ${domReady}, LoadStopped: ${loadStopped}`);
            return;
          }
          
          hasFired = true;
          
          const window = targetWindow || mainWindow;
          if (window && !window.isDestroyed()) {
            const currentUrl = view.webContents.getURL();
            console.log(`✅ ${viewName} BrowserView fully loaded and ready: ${currentUrl}`);
            
            // Additional delay to ensure content is actually rendered
            setTimeout(() => {
              // Send to all windows for synchronization
              broadcastToAllWindows('browser-view-loaded', { viewName, url: currentUrl });
            }, 800); // 800ms delay for content rendering
          }
        };

        // Track when DOM content is ready
        view.webContents.once('dom-content-loaded', () => {
          console.log(`🌳 ${viewName} dom-content-loaded fired`);
          domReady = true;
          fireLoadedEvent();
        });
        
        // Track when loading has completely stopped (better than did-finish-load)
        view.webContents.once('did-stop-loading', () => {
          console.log(`🛑 ${viewName} did-stop-loading fired`);
          loadStopped = true;
          fireLoadedEvent();
        });
        
        // Fallback: also listen to did-finish-load as backup
        view.webContents.once('did-finish-load', () => {
          console.log(`📄 ${viewName} did-finish-load fired (backup)`);
          if (!loadStopped) {
            loadStopped = true;
            fireLoadedEvent();
          }
        });
        
        // Fallback timeout to prevent loading from getting stuck
        setTimeout(() => {
          if (!hasFired) {
            console.log(`⏰ ${viewName} loading timeout - firing anyway`);
            hasFired = true;
            const window = targetWindow || mainWindow;
            if (window && !window.isDestroyed()) {
              const currentUrl = view.webContents.getURL();
              broadcastToAllWindows('browser-view-loaded', { viewName, url: currentUrl });
            }
          }
        }, 8000); // Increased to 8 seconds
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
