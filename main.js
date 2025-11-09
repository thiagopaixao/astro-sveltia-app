const { app, BrowserWindow, ipcMain, Menu, dialog, BrowserView, shell } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { spawn } = require('child_process');
const { rimraf } = require('rimraf');
const { execSync } = require('child_process');
const { createLogger } = require('./src/main/logging/logger');
const { createDocumentalTracker } = require('./src/main/processes/documentalTracker');
const { bootstrapApp } = require('./src/main/bootstrap/app');
const { createProjectService } = require('./src/application/projectService');
const { createGitWorkflowService } = require('./src/application/gitWorkflowService');
const { createNodeEnvironmentService } = require('./src/application/nodeEnvironmentService');
const { createSqliteProjectRepository } = require('./src/infrastructure/database/sqliteProjectRepository');
const { createIsomorphicGitAdapter } = require('./src/infrastructure/git/isomorphicGitAdapter');
const { createNodeCommandAdapter } = require('./src/infrastructure/node/nodeCommandAdapter');

// New imports for GitHub authentication and git operations
const keytar = require('keytar');
const { Octokit } = require('@octokit/rest');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const GITHUB_CONFIG = require('./github-config');

let mainWindow;
let editorView;
let viewerView;
let globalDevServerUrl = null; // Global variable to store dev server URL
let activeProcesses = {}; // To keep track of running child processes

let projectRepository;
let projectService;
let gitAdapter;
let gitWorkflowService;
let nodeAdapter;
let nodeEnvironmentService;

const { getAppLogs } = createLogger({ BrowserWindow });

// GitHub authentication variables


// Store BrowserViews per window for independent control
const windowBrowserViews = new Map(); // windowId -> { editorView, viewerView }

// Flag to prevent multiple cleanup attempts
let isCleaningUp = false;

const documentalTracker = createDocumentalTracker({
  fs,
  path,
  processesFilePath: path.join(app.getPath('userData'), 'documental-processes.json')
});

gitAdapter = createIsomorphicGitAdapter({
  git,
  http,
  fs,
  getGitHubToken,
  sendCommandOutput
});

nodeAdapter = createNodeCommandAdapter({ spawn });

function ensureGitAdapterReady() {
  if (!gitAdapter) {
    throw new Error('Git adapter not initialized');
  }
}

async function gitClone(...args) {
  ensureGitAdapterReady();
  return gitAdapter.clone(...args);
}

async function gitCheckout(...args) {
  ensureGitAdapterReady();
  return gitAdapter.checkout(...args);
}

async function gitGetRemoteUrl(...args) {
  ensureGitAdapterReady();
  return gitAdapter.getRemoteUrl(...args);
}

async function gitSetUserConfig(...args) {
  ensureGitAdapterReady();
  return gitAdapter.setUserConfig(...args);
}

async function gitListBranches(...args) {
  ensureGitAdapterReady();
  return gitAdapter.listBranches(...args);
}

async function gitCreateBranch(...args) {
  ensureGitAdapterReady();
  return gitAdapter.createBranch(...args);
}

async function gitCheckoutBranch(...args) {
  ensureGitAdapterReady();
  return gitAdapter.checkoutBranch(...args);
}

async function gitGetCurrentBranch(...args) {
  ensureGitAdapterReady();
  return gitAdapter.getCurrentBranch(...args);
}

async function gitEnsurePreviewBranch(...args) {
  ensureGitAdapterReady();
  return gitAdapter.ensurePreviewBranch(...args);
}

async function gitGetRepositoryInfo(...args) {
  ensureGitAdapterReady();
  return gitAdapter.getRepositoryInfo(...args);
}

async function gitPullFromPreview(...args) {
  ensureGitAdapterReady();
  return gitAdapter.pullFromPreview(...args);
}

async function gitPushToBranch(...args) {
  ensureGitAdapterReady();
  return gitAdapter.pushToBranch(...args);
}

async function gitListRemoteBranches(...args) {
  ensureGitAdapterReady();
  return gitAdapter.listRemoteBranches(...args);
}

async function configureGitForUser(dir) {
  try {
    const userInfo = await getGitHubUserInfo();
    if (!userInfo) {
      console.warn('⚠️ No GitHub user info available, skipping git config');
      return false;
    }

    const name = userInfo.name || userInfo.login;
    const email = userInfo.email || `${userInfo.login}@users.noreply.github.com`;

    await gitSetUserConfig(dir, name, email);
    return true;
  } catch (error) {
    console.error('Error configuring git for user:', error);
    return false;
  }
}

function addDocumentalProcess(pid, processInfo) {
  documentalTracker.addProcess(pid, processInfo);
}

function removeDocumentalProcess(pid) {
  documentalTracker.removeProcess(pid);
}

function updateDocumentalProcess(pid, updates) {
  documentalTracker.updateProcess(pid, updates);
}

function hasDocumentalProcess(pid) {
  return documentalTracker.hasProcess(pid);
}

// Global output functions for console communication
function sendCommandOutput(output) {
  // Send to all windows for synchronization
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('command-output', output);
    }
  });
}

function sendServerOutput(output) {
  // Send to all windows for synchronization
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('server-output', output);
    }
  });
}

function sendCommandStatus(status) {
  // Send to all windows for synchronization
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('command-status', status);
    }
  });
}

// Reset cleanup flag when app starts
app.on('ready', async () => {
  isCleaningUp = false;
  console.log('🚀 App ready - cleanup flag reset');

  // Load previously tracked Documental processes
  documentalTracker.loadProcesses();

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
  
  const trackedProcesses = documentalTracker.getProcessList();
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
  const trackedProcesses = documentalTracker.getProcessList();
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

// Git operations using isomorphic-git


// Device Flow: Authorization code extraction is no longer needed
// The Device Flow handles authorization through polling instead of code extraction

// GitHub authentication functions
async function checkFirstTimeUser() {
  const isFirstTime = !fs.existsSync(path.join(app.getPath('userData'), 'setup-completed.flag'));
  return isFirstTime;
}

function markSetupCompleted() {
  fs.writeFileSync(path.join(app.getPath('userData'), 'setup-completed.flag'), 'true');
}

async function getGitHubToken() {
  try {
    return await keytar.getPassword(GITHUB_CONFIG.SERVICE_NAME, 'github-token');
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return null;
  }
}

async function setGitHubToken(token) {
  try {
    await keytar.setPassword(GITHUB_CONFIG.SERVICE_NAME, 'github-token', token);
    return true;
  } catch (error) {
    console.error('Error setting GitHub token:', error);
    return false;
  }
}

async function getGitHubUserInfo() {
  try {
    const token = await getGitHubToken();
    if (!token) return null;

    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    
    return {
      login: user.login,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      id: user.id
    };
  } catch (error) {
    console.error('Error getting GitHub user info:', error);
    return null;
  }
}

// Device Flow: Request device and user codes from GitHub
async function requestDeviceCode() {
  try {
    console.log('Requesting device code from GitHub...');
    
    // Validate configuration
    if (!GITHUB_CONFIG.CLIENT_ID || GITHUB_CONFIG.CLIENT_ID === 'Iv1.a1b2c3d4e5f6g7h8') {
      throw new Error('GitHub Client ID not configured. Please set GITHUB_CLIENT_ID environment variable.');
    }
    
    const response = await fetch(GITHUB_CONFIG.DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Documental-App/1.0'
      },
      body: JSON.stringify({
        client_id: GITHUB_CONFIG.CLIENT_ID,
        scope: GITHUB_CONFIG.SCOPES.join(' ')
      })
    });
    
    const data = await response.json();
    console.log('Device code response:', { ...data, device_code: data.device_code ? '***' : undefined });
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Error requesting device code:', error);
    throw error;
  }
}

// Device Flow: Poll GitHub for access token
async function pollForToken(deviceCode, interval, maxAttempts = 60) {
  console.log(`Starting token polling with interval: ${interval}s, max attempts: ${maxAttempts}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`Polling attempt ${attempt + 1}/${maxAttempts}...`);
      
      const response = await fetch(GITHUB_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Documental-App/1.0'
        },
        body: JSON.stringify({
          client_id: GITHUB_CONFIG.CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      
      const data = await response.json();
      console.log('Token poll response:', { 
        ...data, 
        access_token: data.access_token ? '***' : undefined,
        device_code: '***'
      });
      
      if (data.access_token) {
        console.log('✅ Access token received successfully');
        return { success: true, token: data.access_token };
      }
      
      if (data.error === 'authorization_pending') {
        console.log('Authorization pending, continuing polling...');
        // Continuar polling
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        continue;
      }
      
      if (data.error === 'slow_down') {
        console.log('Slow down requested, increasing interval...');
        // Aumentar intervalo em 5 segundos
        await new Promise(resolve => setTimeout(resolve, (interval + 5) * 1000));
        continue;
      }
      
      if (data.error === 'expired_token') {
        console.log('Device code expired');
        return { success: false, error: 'Código de autorização expirado. Tente novamente.' };
      }
      
      if (data.error === 'access_denied') {
        console.log('Access denied by user');
        return { success: false, error: 'Autorização negada pelo usuário.' };
      }
      
      // Outros erros
      const errorMsg = data.error_description || data.error || 'Erro desconhecido';
      console.error('Token polling error:', data);
      return { success: false, error: errorMsg };
      
    } catch (error) {
      console.error(`Error in polling attempt ${attempt + 1}:`, error);
      
      // Se for o último erro, retornar falha
      if (attempt === maxAttempts - 1) {
        return { success: false, error: error.message };
      }
      
      // Esperar antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    }
  }
  
  console.log('Polling timeout reached');
  return { success: false, error: 'Tempo esgotado. Por favor, tente novamente.' };
}

// Device Flow: Exchange device code for access token and get user info
async function exchangeDeviceCodeForToken(deviceCode, interval) {
  try {
    console.log('Exchanging device code for token...');
    
    const tokenResult = await pollForToken(deviceCode, interval);
    
    if (tokenResult.success) {
      // Store the token
      await setGitHubToken(tokenResult.token);
      console.log('Token stored successfully');
      
      // Get user info
      const userInfo = await getGitHubUserInfo();
      console.log('User info retrieved:', userInfo?.login);
      
      return { success: true, userInfo };
    } else {
      throw new Error(tokenResult.error);
    }
  } catch (error) {
    console.error('Error exchanging device code for token:', error);
    throw error;
  }
}

async function authenticateWithGitHub() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🚀 Starting GitHub Device Flow authentication...');
      
      // 1. Solicitar device code
      const deviceResponse = await requestDeviceCode();
      
      const { 
        device_code, 
        user_code, 
        verification_uri, 
        expires_in, 
        interval 
      } = deviceResponse;
      
      console.log('📱 Device code received:', { 
        user_code, 
        verification_uri, 
        expires_in, 
        interval,
        device_code: '***'
      });
      
      // 2. Criar janela modal para mostrar instruções
      const authWindow = new BrowserWindow({
        width: 650,
        height: 550,
        show: false,
        parent: mainWindow,
        modal: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      // 3. Criar HTML com instruções claras
      const instructionsHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autenticação GitHub - Documental</title>
          <meta charset="utf-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #0d1117 0%, #161b22 100%); 
              color: #c9d1d9; 
              padding: 30px; 
              text-align: center; 
              margin: 0; 
              height: 100vh; 
              overflow-y: auto;
            }
            .container { 
              max-width: 450px; 
              margin: 0 auto; 
              background: #21262d;
              border-radius: 12px;
              padding: 30px;
              border: 1px solid #30363d;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
            .logo { 
              font-size: 48px; 
              margin-bottom: 20px;
            }
            h2 { 
              color: #58a6ff; 
              margin-bottom: 15px;
              font-size: 24px;
              font-weight: 600;
            }
            .subtitle {
              color: #8b949e;
              margin-bottom: 25px;
              font-size: 14px;
            }
            .code-container {
              background: #0d1117;
              border: 2px solid #58a6ff;
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
              position: relative;
            }
            .code-label {
              position: absolute;
              top: -10px;
              left: 20px;
              background: #21262d;
              padding: 0 10px;
              color: #58a6ff;
              font-size: 12px;
              font-weight: 600;
            }
            .code { 
              font-size: 36px; 
              font-weight: bold; 
              letter-spacing: 6px; 
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
              color: #c9d1d9;
              text-shadow: 0 0 10px rgba(88, 166, 255, 0.5);
            }
            .steps { 
              text-align: left; 
              margin: 25px 0; 
            }
            .step { 
              margin: 15px 0; 
              padding: 15px; 
              background: #161b22; 
              border-radius: 8px;
              border-left: 3px solid #58a6ff;
            }
            .step-number { 
              font-weight: bold; 
              color: #58a6ff; 
              margin-right: 8px;
            }
            .link { 
              color: #58a6ff; 
              text-decoration: none; 
              font-weight: 500;
            }
            .link:hover { 
              text-decoration: underline; 
            }
            .status { 
              margin-top: 25px; 
              font-size: 14px; 
              color: #8b949e;
            }
            .spinner { 
              border: 3px solid #21262d; 
              border-top: 3px solid #58a6ff; 
              border-radius: 50%; 
              width: 24px; 
              height: 24px; 
              animation: spin 1s linear infinite; 
              margin: 15px auto;
            }
            @keyframes spin { 
              0% { transform: rotate(0deg); } 
              100% { transform: rotate(360deg); } 
            }
            .warning {
              background: #441e1e;
              border: 1px solid #f85149;
              border-radius: 6px;
              padding: 12px;
              margin: 15px 0;
              font-size: 12px;
              color: #f85149;
            }
            .success {
              background: #1a3f1a;
              border: 1px solid #3fb950;
              border-radius: 6px;
              padding: 12px;
              margin: 15px 0;
              color: #3fb950;
            }
            .error {
              background: #441e1e;
              border: 1px solid #f85149;
              border-radius: 6px;
              padding: 12px;
              margin: 15px 0;
              color: #f85149;
            }
            .copy-button {
              background: #58a6ff;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 12px;
              margin-top: 10px;
              transition: background 0.2s;
            }
            .copy-button:hover {
              background: #4493f8;
            }
            .copy-button.copied {
              background: #3fb950;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🔐</div>
            <h2>Conectar com GitHub</h2>
            <p class="subtitle">Use o código abaixo para autorizar o Documental</p>
            
            <div class="warning">
              ⚠️ Mantenha esta janela aberta durante a autenticação
            </div>
            
            <div class="code-container">
              <div class="code-label">SEU CÓDIGO</div>
              <div class="code" id="userCode">${user_code}</div>
              <button class="copy-button" onclick="copyCode()">📋 Copiar Código</button>
            </div>
            
            <div class="steps">
              <div class="step">
                <span class="step-number">1.</span>
                <strong>Visite:</strong> 
                <a href="${verification_uri}" target="_blank" class="link">${verification_uri}</a>
              </div>
              <div class="step">
                <span class="step-number">2.</span>
                <strong>Digite o código:</strong> ${user_code}
              </div>
              <div class="step">
                <span class="step-number">3.</span>
                <strong>Autorize</strong> o acesso do Documental App
              </div>
            </div>
            
            <div class="status" id="status">
              <div class="spinner"></div>
              <p><strong>Aguardando autorização...</strong></p>
              <p id="timer">⏱️ Tempo restante: ${Math.floor(expires_in / 60)}:${(expires_in % 60).toString().padStart(2, '0')}</p>
            </div>
          </div>
          
          <script>
            let timeLeft = ${expires_in};
            const timerEl = document.getElementById('timer');
            const statusEl = document.getElementById('status');
            
            function updateStatus(message, type = 'info') {
              const statusHTML = type === 'success' ? 
                '<div class="success">✅ ' + message + '</div>' :
                type === 'error' ? 
                '<div class="error">❌ ' + message + '</div>' :
                '<div class="spinner"></div><p><strong>' + message + '</strong></p>';
              
              statusEl.innerHTML = statusHTML + '<p id="timer">⏱️ Tempo restante: ' + formatTime(timeLeft) + '</p>';
            }
            
            function formatTime(seconds) {
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              return mins + ':' + secs.toString().padStart(2, '0');
            }
            
            function copyCode() {
              const code = '${user_code}';
              navigator.clipboard.writeText(code).then(() => {
                const btn = document.querySelector('.copy-button');
                btn.textContent = '✅ Copiado!';
                btn.classList.add('copied');
                setTimeout(() => {
                  btn.textContent = '📋 Copiar Código';
                  btn.classList.remove('copied');
                }, 2000);
              });
            }
            
            const timer = setInterval(() => {
              timeLeft--;
              const timerEl = document.getElementById('timer');
              if (timerEl) {
                timerEl.textContent = '⏱️ Tempo restante: ' + formatTime(timeLeft);
              }
              
              if (timeLeft <= 60) {
                updateStatus('Código expirando em breve! Aja rápido.', 'warning');
              }
              
              if (timeLeft <= 0) {
                clearInterval(timer);
                updateStatus('Código expirado. Feche esta janela e tente novamente.', 'error');
              }
            }, 1000);
            
            // Auto-focus on the code for better visibility
            document.addEventListener('DOMContentLoaded', () => {
              const codeEl = document.getElementById('userCode');
              if (codeEl) {
                codeEl.style.animation = 'pulse 2s infinite';
              }
            });
          </script>
        </body>
        </html>
      `;
      
      // 4. Carregar página de instruções
      await authWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(instructionsHTML));
      authWindow.show();
      authWindow.center();
      
      // 5. Iniciar polling em background
      console.log('🔄 Starting token polling...');
      const tokenResult = await exchangeDeviceCodeForToken(device_code, interval);
      
      // 6. Fechar janela de instruções
      authWindow.close();
      
      if (tokenResult.success) {
        console.log('✅ Authentication successful');
        resolve(tokenResult);
      } else {
        console.log('❌ Authentication failed:', tokenResult.error);
        resolve({ success: false, error: tokenResult.error });
      }
      
    } catch (error) {
      console.error('❌ Device flow authentication error:', error);
      resolve({ success: false, error: error.message });
    }
  });
}

// Node.js detection and installation functions
const MIN_NODE_VERSION = 22;
const NODE_VERSION = '22.11.0'; // Specific version to install

// Store custom Node.js paths for future use
let customNodePath = null;
let customNpmPath = null;

async function detectNodeInstallation() {
  try {
    console.log('🔍 Starting intelligent Node.js detection...');
    
    // Step 1: Detect existing Node.js installation
    const nodeInfo = await detectNodeVersion();
    
    if (nodeInfo.installed && nodeInfo.valid) {
      console.log(`✅ Valid Node.js installation found: v${nodeInfo.version}`);
      return {
        status: 'valid',
        message: `Node.js v${nodeInfo.version} já está instalado e é válido`,
        nodeInfo,
        needsInstallation: false
      };
    }
    
    // Step 2: If invalid or missing, detect existing NVM
    console.log('🔍 Node.js not valid or missing, checking for existing NVM...');
    const nvmInfo = await detectExistingNvm();
    
    let message = nodeInfo.installed ? 
      `Node.js v${nodeInfo.version} é muito antigo (requer v${MIN_NODE_VERSION}+)` : 
      'Node.js não encontrado';
    
    if (nvmInfo.exists) {
      message += ` - NVM detectado em ${nvmInfo.path}`;
    }
    
    console.log(`📋 Detection result: ${message}`);
    
    return {
      status: 'needs_installation',
      message,
      nodeInfo,
      nvmInfo,
      needsInstallation: true
    };
  } catch (error) {
    console.error('Error in intelligent Node.js detection:', error);
    return {
      status: 'error',
      message: `Erro na detecção: ${error.message}`,
      needsInstallation: true,
      error: error.message
    };
  }
}

async function detectNodeVersion() {
  try {
    console.log('🔍 Detecting Node.js installation...');
    
    // First try to detect custom installation if available
    if (customNodePath) {
      console.log('🔍 Checking custom Node.js installation...');
      const customResult = await checkSpecificNodeInstallation(customNodePath);
      if (customResult.installed && customResult.valid) {
        console.log(`✅ Custom Node.js detected: v${customResult.version}`);
        return {
          installed: true,
          version: customResult.version,
          valid: customResult.valid,
          path: customNodePath,
          isCustom: true
        };
      }
    }
    
    // Then try to detect from PATH
    console.log('🔍 Checking system PATH Node.js installation...');
    const systemResult = await checkSpecificNodeInstallation('node');
    if (systemResult.installed) {
      console.log(`✅ System Node.js detected: v${systemResult.version}`);
      return {
        installed: true,
        version: systemResult.version,
        valid: systemResult.valid,
        path: systemResult.path,
        isCustom: false
      };
    }
    
    console.log('❌ Node.js not found');
    return {
      installed: false,
      version: null,
      valid: false,
      path: null,
      isCustom: false
    };
  } catch (error) {
    console.error('Error detecting Node.js:', error);
    return {
      installed: false,
      version: null,
      valid: false,
      path: null,
      isCustom: false
    };
  }
}

async function detectExistingNvm() {
  try {
    console.log('🔍 Detecting existing NVM installation...');
    
    const os = require('os');
    const possibleNvmPaths = [
      path.join(os.homedir(), '.nvm'),
      path.join(os.homedir(), '.config', 'nvm'),
      process.env.NVM_DIR
    ].filter(Boolean);
    
    // Remove duplicates
    const uniquePaths = [...new Set(possibleNvmPaths)];
    
    for (const nvmPath of uniquePaths) {
      console.log(`🔍 Checking NVM path: ${nvmPath}`);
      
      if (fs.existsSync(nvmPath)) {
        console.log(`📁 NVM directory found: ${nvmPath}`);
        
        // Check for Unix NVM
        const nvmSh = path.join(nvmPath, 'nvm.sh');
        if (fs.existsSync(nvmSh)) {
          console.log('✅ Unix NVM detected (nvm.sh found)');
          return {
            exists: true,
            path: nvmPath,
            type: 'unix',
            executable: nvmSh
          };
        }
        
        // Check for Windows NVM
        const nvmExe = path.join(nvmPath, 'nvm.exe');
        if (fs.existsSync(nvmExe)) {
          console.log('✅ Windows NVM detected (nvm.exe found)');
          return {
            exists: true,
            path: nvmPath,
            type: 'windows',
            executable: nvmExe
          };
        }
        
        console.log(`⚠️ NVM directory exists but no executable found`);
      }
    }
    
    console.log('❌ No existing NVM installation found');
    return { exists: false };
  } catch (error) {
    console.error('Error detecting existing NVM:', error);
    return { exists: false, error: error.message };
  }
}

async function checkSpecificNodeInstallation(nodeExecutable) {
  try {
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const nodeProcess = spawn(nodeExecutable, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });
      
      let stdout = '';
      let stderr = '';
      
      nodeProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      nodeProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      nodeProcess.on('close', (code) => {
        if (code === 0 && stdout) {
          const version = stdout.trim().replace('v', '');
          resolve({
            installed: true,
            version: version,
            valid: isNodeVersionValid(version),
            path: nodeExecutable
          });
        } else {
          resolve({
            installed: false,
            version: null,
            valid: false,
            path: nodeExecutable
          });
        }
      });
      
      nodeProcess.on('error', () => {
        resolve({
          installed: false,
          version: null,
          valid: false,
          path: nodeExecutable
        });
      });
    });
  } catch (error) {
    return {
      installed: false,
      version: null,
      valid: false,
      path: nodeExecutable
    };
  }
}

function isNodeVersionValid(version) {
  if (!version) return false;
  
  try {
    const versionParts = version.split('.').map(part => parseInt(part, 10));
    const majorVersion = versionParts[0];
    
    return majorVersion >= MIN_NODE_VERSION;
  } catch (error) {
    console.error('Error parsing Node.js version:', error);
    return false;
  }
}

function getNodeExecutablePath() {
  try {
    if (process.platform === 'win32') {
      return process.env.NODE_PATH || 'node.exe';
    } else {
      return process.env.NODE_PATH || 'node';
    }
  } catch (error) {
    return null;
  }
}

function getNvmInstallPath() {
  const userDataPath = app.getPath('userData');
  const nvmPath = path.join(userDataPath, 'nvm');
  
  if (!fs.existsSync(nvmPath)) {
    fs.mkdirSync(nvmPath, { recursive: true });
  }
  
  return nvmPath;
}

function getNodeInstallPath() {
  const nvmPath = getNvmInstallPath();
  const nodePath = path.join(nvmPath, 'node-v' + NODE_VERSION);
  
  if (!fs.existsSync(nodePath)) {
    fs.mkdirSync(nodePath, { recursive: true });
  }
  
  return nodePath;
}

async function installNvm() {
  try {
    console.log('🔄 Installing NVM...');
    const platform = process.platform;
    const nvmPath = getNvmInstallPath();
    
    if (platform === 'win32') {
      return await installNvmWindows(nvmPath);
    } else {
      return await installNvmUnix(nvmPath);
    }
  } catch (error) {
    console.error('Error installing NVM:', error);
    throw error;
  }
}

async function installNvmWindows(nvmPath) {
  try {
    console.log('📦 Installing NVM for Windows...');
    
    // Download NVM for Windows
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    
    const nvmZipPath = path.join(nvmPath, 'nvm-windows.zip');
    const nvmUrl = 'https://github.com/coreybutler/nvm-windows/releases/download/1.1.11/nvm-noinstall.zip';
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(nvmZipPath);
      
      https.get(nvmUrl, (response) => {
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('✅ NVM for Windows downloaded');
          
          // Extract the ZIP file
          const { spawn } = require('child_process');
          const tar = spawn('tar', ['-xf', nvmZipPath, '-C', nvmPath], {
            stdio: 'pipe'
          });
          
          tar.on('close', (code) => {
            if (code === 0) {
              console.log('✅ NVM for Windows extracted');
              
              // Create settings.txt
              const settingsPath = path.join(nvmPath, 'settings.txt');
              const settings = `root: ${nvmPath.replace(/\\/g, '/')}/nodejs
path: ${nvmPath.replace(/\\/g, '/')}/nodejs
arch: 64
proxy: none
originalpath: ${nvmPath.replace(/\\/g, '/')}/nodejs
originalversion: `;
              
              fs.writeFileSync(settingsPath, settings);
              
              // Create nodejs directory
              const nodejsPath = path.join(nvmPath, 'nodejs');
              if (!fs.existsSync(nodejsPath)) {
                fs.mkdirSync(nodejsPath, { recursive: true });
              }
              
              resolve({ success: true, nvmPath: path.join(nvmPath, 'nvm.exe') });
            } else {
              reject(new Error('Failed to extract NVM for Windows'));
            }
          });
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error installing NVM for Windows:', error);
    throw error;
  }
}

async function installNvmUnix(nvmPath) {
  try {
    console.log('📦 Installing NVM for Unix...');
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      // Download and install NVM using curl
      const installScript = `
        # Limpar ambiente para evitar conflitos
        unset npm_config_prefix
        unset NVM_BIN
        unset NODE_PATH
        export NVM_DIR="${nvmPath}"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        source "${nvmPath}/nvm.sh"
      `;
      
      const install = spawn('bash', ['-c', installScript], {
        stdio: 'pipe',
        env: {
          ...process.env,
          NVM_DIR: nvmPath,
          // Limpar variáveis conflitantes
          npm_config_prefix: undefined,
          NVM_BIN: undefined,
          NODE_PATH: undefined
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      install.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      install.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          console.log('✅ NVM for Unix installed');
          resolve({ success: true, nvmPath: path.join(nvmPath, 'nvm.sh') });
        } else {
          console.error('NVM installation stderr:', stderr);
          
          // Check for specific npm_config_prefix error
          if (stderr.includes('npm_config_prefix') && stderr.includes('not compatible')) {
            const errorMsg = 'NVM installation failed due to conflicting npm_config_prefix environment variable. ' +
                           'This usually happens when Node.js was previously installed with NVM. ' +
                           'Try running: unset npm_config_prefix && npm start';
            reject(new Error(errorMsg));
          } else {
            reject(new Error('Failed to install NVM for Unix'));
          }
        }
      });
    });
  } catch (error) {
    console.error('Error installing NVM for Unix:', error);
    throw error;
  }
}

async function installNodeJsIntelligently() {
  try {
    console.log('🚀 Starting intelligent Node.js installation...');
    
    const nvmInfo = await detectExistingNvm();
    
    if (nvmInfo.exists) {
      console.log('🔧 Using existing NVM installation');
      console.log(`📍 NVM path: ${nvmInfo.path}`);
      console.log(`📍 NVM type: ${nvmInfo.type}`);
      return await installNodeViaExistingNvm(nvmInfo);
    } else {
      console.log('📦 No existing NVM found, installing NVM first...');
      return await installNvmAndNode();
    }
  } catch (error) {
    console.error('Error in intelligent Node.js installation:', error);
    throw error;
  }
}

async function installNodeViaExistingNvm(nvmInfo) {
  try {
    console.log(`🔧 Installing Node.js v${NODE_VERSION} via existing NVM...`);
    
    if (nvmInfo.type === 'windows') {
      return await installNodeViaExistingNvmWindows(nvmInfo.path);
    } else {
      return await installNodeViaExistingNvmUnix(nvmInfo.path);
    }
  } catch (error) {
    console.error('Error installing Node.js via existing NVM:', error);
    throw error;
  }
}

async function installNodeViaExistingNvmUnix(nvmPath) {
  try {
    console.log('📦 Installing Node.js via existing Unix NVM...');
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const installScript = `
        # Limpar ambiente para evitar conflitos
        unset npm_config_prefix
        unset NVM_BIN
        export NVM_DIR="${nvmPath}"
        
        # Carregar NVM existente
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Verificar se NVM está funcionando
        nvm --version
        
        # Instalar versão correta
        echo "Installing Node.js ${NODE_VERSION}..."
        nvm install ${NODE_VERSION}
        nvm use ${NODE_VERSION}
        nvm alias default ${NODE_VERSION}
        
        # Garantir que NVM_BIN esteja definido
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Obter caminhos corretos
        NODE_PATH=$(which node)
        NPM_PATH=$(which npm)
        
        echo "NODE_PATH:$NODE_PATH"
        echo "NPM_PATH:$NPM_PATH"
        
        # Verificar versões
        $NODE_PATH --version
        $NPM_PATH --version
      `;
      
      const install = spawn('bash', ['-c', installScript], {
        stdio: 'pipe',
        env: {
          ...process.env,
          NVM_DIR: nvmPath,
          // Limpar variáveis conflitantes
          npm_config_prefix: undefined,
          NVM_BIN: undefined
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      install.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('Existing NVM Install Output:', output.trim());
      });
      
      install.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('Existing NVM Install Error:', output.trim());
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Node.js installed via existing NVM');
          
          const lines = stdout.split('\n');
          const nodeLine = lines.find(line => line.startsWith('NODE_PATH:'));
          const npmLine = lines.find(line => line.startsWith('NPM_PATH:'));
          
          if (nodeLine && npmLine) {
            const nodePath = nodeLine.replace('NODE_PATH:', '').trim();
            const npmPath = npmLine.replace('NPM_PATH:', '').trim();
            
            console.log(`📍 Extracted paths from existing NVM:`);
            console.log(`   Node: ${nodePath}`);
            console.log(`   npm: ${npmPath}`);
            
            // Verify the paths exist
            if (!fs.existsSync(nodePath)) {
              reject(new Error(`Node.js executable not found at: ${nodePath}`));
              return;
            }
            
            if (!fs.existsSync(npmPath)) {
              reject(new Error(`npm executable not found at: ${npmPath}`));
              return;
            }
            
            customNodePath = nodePath;
            customNpmPath = npmPath;
            
            resolve({ 
              success: true, 
              nodePath: nodePath,
              npmPath: npmPath,
              usedExistingNvm: true
            });
          } else {
            console.error('Could not find path markers in existing NVM output');
            console.error('STDOUT:', stdout);
            reject(new Error('Could not determine Node.js/npm paths from existing NVM installation'));
          }
        } else {
          console.error('Node.js installation via existing NVM failed with code:', code);
          console.error('STDERR:', stderr);
          reject(new Error(`Failed to install Node.js via existing NVM (exit code: ${code})`));
        }
      });
    });
  } catch (error) {
    console.error('Error installing Node.js via existing NVM Unix:', error);
    throw error;
  }
}

async function installNodeViaExistingNvmWindows(nvmPath) {
  try {
    console.log('📦 Installing Node.js via existing Windows NVM...');
    
    const { spawn } = require('child_process');
    const nvmExe = path.join(nvmPath, 'nvm.exe');
    
    return new Promise((resolve, reject) => {
      // Install the specific version
      const install = spawn(nvmExe, ['install', NODE_VERSION], {
        stdio: 'pipe',
        cwd: nvmPath,
        env: {
          ...process.env,
          // Limpar variáveis conflitantes
          npm_config_prefix: undefined
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      install.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('Existing NVM Windows Install:', output.trim());
      });
      
      install.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('Existing NVM Windows Error:', output.trim());
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Node.js installed via existing Windows NVM');
          
          // Set the installed version as current
          const use = spawn(nvmExe, ['use', NODE_VERSION], {
            stdio: 'pipe',
            cwd: nvmPath,
            env: { ...process.env, npm_config_prefix: undefined }
          });
          
          let useStdout = '';
          let useStderr = '';
          
          use.stdout.on('data', (data) => {
            const output = data.toString();
            useStdout += output;
            console.log('Existing NVM Windows Use:', output.trim());
          });
          
          use.stderr.on('data', (data) => {
            const output = data.toString();
            useStderr += output;
            console.log('Existing NVM Windows Use Error:', output.trim());
          });
          
          use.on('close', (useCode) => {
            if (useCode === 0) {
              console.log('✅ Node.js set as current via existing NVM');
              
              // Try to find the installed Node.js in the existing NVM structure
              const nodejsDir = path.join(nvmPath, 'nodejs');
              if (fs.existsSync(nodejsDir)) {
                const versions = fs.readdirSync(nodejsDir).filter(dir => 
                  dir.includes(`node-v${NODE_VERSION}`)
                );
                
                if (versions.length > 0) {
                  const versionDir = path.join(nodejsDir, versions[0]);
                  const nodePath = path.join(versionDir, 'node.exe');
                  const npmPath = path.join(versionDir, 'npm.cmd');
                  
                  if (fs.existsSync(nodePath) && fs.existsSync(npmPath)) {
                    console.log(`📍 Found Node.js in existing NVM: ${nodePath}`);
                    
                    customNodePath = nodePath;
                    customNpmPath = npmPath;
                    
                    resolve({ 
                      success: true, 
                      nodePath: nodePath,
                      npmPath: npmPath,
                      usedExistingNvm: true
                    });
                    return;
                  }
                }
              }
              
              reject(new Error('Could not locate Node.js in existing NVM installation'));
            } else {
              console.error('Failed to use Node.js version in existing NVM. Code:', useCode);
              console.error('STDERR:', useStderr);
              reject(new Error('Failed to use Node.js version via existing NVM'));
            }
          });
        } else {
          console.error('Node.js installation via existing NVM failed. Code:', code);
          console.error('STDERR:', stderr);
          reject(new Error(`Failed to install Node.js via existing NVM (exit code: ${code})`));
        }
      });
    });
  } catch (error) {
    console.error('Error installing Node.js via existing NVM Windows:', error);
    throw error;
  }
}

async function installNvmAndNode() {
  try {
    console.log('📦 Installing NVM first, then Node.js...');
    
    // Step 1: Install NVM
    const nvmResult = await installNvm();
    if (!nvmResult.success) {
      throw new Error('Failed to install NVM: ' + (nvmResult.error || 'Unknown error'));
    }
    console.log('✅ NVM installation completed');
    
    // Step 2: Install Node.js via newly installed NVM
    const nodeResult = await installNodeViaNvm();
    if (!nodeResult.success) {
      throw new Error('Failed to install Node.js: ' + (nodeResult.error || 'Unknown error'));
    }
    console.log('✅ Node.js installation completed via new NVM');
    
    return {
      ...nodeResult,
      usedExistingNvm: false
    };
  } catch (error) {
    console.error('Error installing NVM and Node.js:', error);
    throw error;
  }
}

async function installNodeViaNvm() {
  try {
    console.log('🔄 Installing Node.js via NVM...');
    const platform = process.platform;
    const nvmPath = getNvmInstallPath();
    
    if (platform === 'win32') {
      return await installNodeViaNvmWindows(nvmPath);
    } else {
      return await installNodeViaNvmUnix(nvmPath);
    }
  } catch (error) {
    console.error('Error installing Node.js via NVM:', error);
    throw error;
  }
}

async function installNodeViaNvmWindows(nvmPath) {
  try {
    console.log('📦 Installing Node.js via NVM Windows...');
    
    const { spawn } = require('child_process');
    const nvmExe = path.join(nvmPath, 'nvm.exe');
    
    return new Promise((resolve, reject) => {
      // First install the specific version
      const install = spawn(nvmExe, ['install', NODE_VERSION], {
        stdio: 'pipe',
        cwd: nvmPath,
        env: { ...process.env }
      });
      
      let stdout = '';
      let stderr = '';
      
      install.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('NVM Windows Install:', output.trim());
      });
      
      install.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('NVM Windows Error:', output.trim());
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Node.js v' + NODE_VERSION + ' installed via NVM Windows');
          
          // Set the installed version as current
          const use = spawn(nvmExe, ['use', NODE_VERSION], {
            stdio: 'pipe',
            cwd: nvmPath,
            env: { ...process.env }
          });
          
          let useStdout = '';
          let useStderr = '';
          
          use.stdout.on('data', (data) => {
            const output = data.toString();
            useStdout += output;
            console.log('NVM Windows Use:', output.trim());
          });
          
          use.stderr.on('data', (data) => {
            const output = data.toString();
            useStderr += output;
            console.log('NVM Windows Use Error:', output.trim());
          });
          
          use.on('close', (useCode) => {
            if (useCode === 0) {
              console.log('✅ Node.js v' + NODE_VERSION + ' set as current');
              
              // Try multiple possible paths for Windows
              const possiblePaths = [
                path.join(nvmPath, 'nodejs', `node-v${NODE_VERSION}-win-x64`, 'node.exe'),
                path.join(nvmPath, 'nodejs', `node-v${NODE_VERSION}-win-x86`, 'node.exe'),
                path.join(nvmPath, 'nodejs', `node-v${NODE_VERSION}`, 'node.exe')
              ];
              
              let nodePath = null;
              let npmPath = null;
              
              // Find the correct Node.js path
              for (const possibleNodePath of possiblePaths) {
                if (fs.existsSync(possibleNodePath)) {
                  nodePath = possibleNodePath;
                  npmPath = path.join(path.dirname(possibleNodePath), 'npm.cmd');
                  
                  // If npm.cmd doesn't exist, try npm.exe
                  if (!fs.existsSync(npmPath)) {
                    npmPath = path.join(path.dirname(possibleNodePath), 'npm.exe');
                  }
                  
                  console.log(`📍 Found Node.js at: ${nodePath}`);
                  console.log(`📍 Found npm at: ${npmPath}`);
                  break;
                }
              }
              
              if (nodePath && npmPath && fs.existsSync(nodePath) && fs.existsSync(npmPath)) {
                // Verify the version
                const verify = spawn(nodePath, ['--version'], {
                  stdio: 'pipe'
                });
                
                let verifyStdout = '';
                verify.stdout.on('data', (data) => {
                  verifyStdout += data.toString();
                });
                
                verify.on('close', (verifyCode) => {
                  if (verifyCode === 0) {
                    const installedVersion = verifyStdout.trim().replace('v', '');
                    const expectedMajor = NODE_VERSION.split('.')[0];
                    
                    if (installedVersion.startsWith(expectedMajor)) {
                      console.log(`✅ Verified Node.js v${installedVersion}`);
                      
                      customNodePath = nodePath;
                      customNpmPath = npmPath;
                      
                      resolve({ 
                        success: true, 
                        nodePath: nodePath,
                        npmPath: npmPath
                      });
                    } else {
                      reject(new Error(`Version mismatch: expected v${expectedMajor}.x.x, got v${installedVersion}`));
                    }
                  } else {
                    reject(new Error('Failed to verify installed Node.js version'));
                  }
                });
              } else {
                console.error('Could not find Node.js executables at expected paths:');
                console.error('Tried paths:', possiblePaths);
                reject(new Error('Could not locate Node.js executables after installation'));
              }
            } else {
              console.error('Failed to set Node.js version. Code:', useCode);
              console.error('STDERR:', useStderr);
              reject(new Error('Failed to use Node.js version'));
            }
          });
        } else {
          console.error('Node.js installation failed. Code:', code);
          console.error('STDERR:', stderr);
          reject(new Error(`Failed to install Node.js via NVM Windows (exit code: ${code})`));
        }
      });
    });
  } catch (error) {
    console.error('Error installing Node.js via NVM Windows:', error);
    throw error;
  }
}

async function installNodeViaNvmUnix(nvmPath) {
  try {
    console.log('📦 Installing Node.js via NVM Unix...');
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const installScript = `
        # Limpar ambiente para evitar conflitos
        unset npm_config_prefix
        unset NVM_BIN
        unset NODE_PATH
        export NVM_DIR="${nvmPath}"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Clear any existing node/npm from PATH
        export PATH=$(echo "$PATH" | tr ':' '\n' | grep -v "node" | tr '\n' ':' | sed 's/:$//')
        
        # Install and use specific version
        nvm install ${NODE_VERSION}
        nvm use ${NODE_VERSION}
        nvm alias default ${NODE_VERSION}
        
        # Reload NVM to ensure NVM_BIN is set correctly
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Get the exact paths - use full paths
        NODE_PATH=\$(which node)
        NPM_PATH=\$(which npm)
        
        echo "NODE_PATH:\$NODE_PATH"
        echo "NPM_PATH:\$NPM_PATH"
        
        # Verify versions
        \$NODE_PATH --version
        \$NPM_PATH --version
      `;
      
      const install = spawn('bash', ['-c', installScript], {
        stdio: 'pipe',
        env: { 
          ...process.env, 
          NVM_DIR: nvmPath,
          // Limpar variáveis conflitantes
          npm_config_prefix: undefined,
          NVM_BIN: undefined,
          NODE_PATH: undefined,
          PATH: process.env.PATH // Ensure original PATH is available
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      install.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('NVM Install Output:', output.trim());
      });
      
      install.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('NVM Install Error:', output.trim());
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Node.js installed via NVM Unix');
          
          const lines = stdout.split('\n');
          const nodeLine = lines.find(line => line.startsWith('NODE_PATH:'));
          const npmLine = lines.find(line => line.startsWith('NPM_PATH:'));
          const versionLine = lines.find(line => line.includes('v' + NODE_VERSION.split('.')[0]));
          
          if (nodeLine && npmLine) {
            const nodePath = nodeLine.replace('NODE_PATH:', '').trim();
            const npmPath = npmLine.replace('NPM_PATH:', '').trim();
            
            console.log(`📍 Extracted paths:`);
            console.log(`   Node: ${nodePath}`);
            console.log(`   npm: ${npmPath}`);
            
            // Verify the paths exist
            if (!require('fs').existsSync(nodePath)) {
              reject(new Error(`Node.js executable not found at: ${nodePath}`));
              return;
            }
            
            if (!require('fs').existsSync(npmPath)) {
              reject(new Error(`npm executable not found at: ${npmPath}`));
              return;
            }
            
            customNodePath = nodePath;
            customNpmPath = npmPath;
            
            resolve({ 
              success: true, 
              nodePath: nodePath,
              npmPath: npmPath
            });
          } else {
            console.error('Could not find path markers in output');
            console.error('STDOUT:', stdout);
            reject(new Error('Could not determine Node.js/npm paths from installation output'));
          }
        } else {
          console.error('Node.js installation failed with code:', code);
          console.error('STDERR:', stderr);
          reject(new Error(`Failed to install Node.js via NVM Unix (exit code: ${code})`));
        }
      });
    });
  } catch (error) {
    console.error('Error installing Node.js via NVM Unix:', error);
    throw error;
  }
}

function configureNodePath() {
  try {
    console.log('🔧 Configuring Node.js paths...');
    
    if (customNodePath && customNpmPath) {
      // Add to current process environment
      const nodeDir = path.dirname(customNodePath);
      
      if (process.platform === 'win32') {
        process.env.PATH = `${nodeDir};${process.env.PATH}`;
      } else {
        process.env.PATH = `${nodeDir}:${process.env.PATH}`;
      }
      
      // Store paths for future use
      process.env.CUSTOM_NODE_PATH = customNodePath;
      process.env.CUSTOM_NPM_PATH = customNpmPath;
      
      // Also set as default for this session
      process.env.NODE_PATH = customNodePath;
      process.env.NPM_PATH = customNpmPath;
      
      console.log(`✅ Node.js paths configured:`);
      console.log(`   Node: ${customNodePath}`);
      console.log(`   npm: ${customNpmPath}`);
      console.log(`   PATH: ${nodeDir}`);
      
      return true;
    }
    
    console.log('⚠️ No custom Node.js paths to configure');
    return false;
  } catch (error) {
    console.error('Error configuring Node.js paths:', error);
    return false;
  }
}

async function verifyNodeInstallation() {
  try {
    console.log('🔍 Verifying Node.js installation...');
    
    if (!customNodePath || !customNpmPath) {
      throw new Error('Custom Node.js paths not available for verification');
    }
    
    const { spawn } = require('child_process');
    
    // Check Node.js version with custom path
    const nodeVersion = await new Promise((resolve) => {
      const nodeProcess = spawn(customNodePath, ['--version'], {
        stdio: 'pipe',
        env: { ...process.env, PATH: path.dirname(customNodePath) + ':' + process.env.PATH }
      });
      
      let stdout = '';
      let stderr = '';
      
      nodeProcess.stdout.on('data', (data) => stdout += data.toString());
      nodeProcess.stderr.on('data', (data) => stderr += data.toString());
      nodeProcess.on('close', (code) => {
        if (code === 0 && stdout) {
          resolve(stdout.trim());
        } else {
          console.error('Node.js verification error:', stderr);
          resolve(null);
        }
      });
    });
    
    // Check npm version with custom path
    const npmVersion = await new Promise((resolve) => {
      const npmProcess = spawn(customNpmPath, ['--version'], {
        stdio: 'pipe',
        env: { ...process.env, PATH: path.dirname(customNpmPath) + ':' + process.env.PATH }
      });
      
      let stdout = '';
      let stderr = '';
      
      npmProcess.stdout.on('data', (data) => stdout += data.toString());
      npmProcess.stderr.on('data', (data) => stderr += data.toString());
      npmProcess.on('close', (code) => {
        if (code === 0 && stdout) {
          resolve(stdout.trim());
        } else {
          console.error('npm verification error:', stderr);
          resolve(null);
        }
      });
    });
    
    if (nodeVersion && npmVersion) {
      const nodeVersionClean = nodeVersion.replace('v', '');
      const expectedMajorVersion = NODE_VERSION.split('.')[0]; // 22
      
      // Verify that the installed version matches what we expected
      if (!nodeVersionClean.startsWith(expectedMajorVersion)) {
        throw new Error(`Expected Node.js v${expectedMajorVersion}.x.x, but found v${nodeVersionClean}`);
      }
      
      console.log(`✅ Node.js ${nodeVersion} and npm ${npmVersion} verified`);
      console.log(`✅ Version validation: v${nodeVersionClean} matches expected v${expectedMajorVersion}.x.x`);
      
      return {
        success: true,
        nodeVersion: nodeVersionClean,
        npmVersion: npmVersion,
        nodePath: customNodePath,
        npmPath: customNpmPath
      };
    } else {
      throw new Error('Node.js or npm verification failed - no version output received');
    }
  } catch (error) {
    console.error('Error verifying Node.js installation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function getNpmPath() {
  // Always prefer custom npm path if available
  if (customNpmPath) {
    console.log(`📍 Using custom npm path: ${customNpmPath}`);
    return customNpmPath;
  }
  console.log('📍 Using system npm');
  return 'npm';
}

function getNodePath() {
  // Always prefer custom node path if available
  if (customNodePath) {
    console.log(`📍 Using custom node path: ${customNodePath}`);
    return customNodePath;
  }
  console.log('📍 Using system node');
  return 'node';
}

async function createWindow() {
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

  // Check if it's the first time using the app
  const isFirstTime = await checkFirstTimeUser();
  
  if (isFirstTime) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'welcome.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  // Hide the menu bar
  Menu.setApplicationMenu(null);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

let db;

function initializeDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'documental.db');

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        reject(err);
        return;
      }

      console.log('Connected to the SQLite database.');

      try {
        projectRepository = createSqliteProjectRepository({ db });
      } catch (creationError) {
        reject(creationError);
        return;
      }

      projectRepository.initialize()
        .then(() => ensureUsersTable(db))
        .then(() => {
          projectService = createProjectService({ projectRepository, pathUtils: path });
          gitWorkflowService = createGitWorkflowService({ gitAdapter, projectService });
          nodeEnvironmentService = createNodeEnvironmentService({ nodeAdapter, projectService });
          resolve();
        })
        .catch((initializationError) => {
          console.error('Error initializing database tables:', initializationError);
          reject(initializationError);
        });
    });
  });
}

function ensureUsersTable(database) {
  return new Promise((resolve, reject) => {
    database.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      githubId INTEGER UNIQUE NOT NULL,
      login TEXT NOT NULL,
      name TEXT,
      email TEXT,
      avatarUrl TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message);
        reject(err);
      } else {
        console.log('Users table ensured.');
        resolve();
      }
    });
  });
}

function registerMainEventHandlers() {
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

  // GitHub authentication handlers
  ipcMain.handle('checkGitHubAuth', async () => {
    try {
      const token = await getGitHubToken();
      if (!token) {
        return { authenticated: false };
      }

      const userInfo = await getGitHubUserInfo();
      if (userInfo) {
        return { authenticated: true, userInfo };
      } else {
        return { authenticated: false };
      }
    } catch (error) {
      console.error('Error checking GitHub auth:', error);
      return { authenticated: false, error: error.message };
    }
  });

  ipcMain.handle('authenticateWithGitHub', async () => {
    try {
      const result = await authenticateWithGitHub();
      
      if (result.success && result.userInfo) {
        // Save user info to database
        await new Promise((resolve, reject) => {
          db.run(`INSERT OR REPLACE INTO users (githubId, login, name, email, avatarUrl, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [result.userInfo.id, result.userInfo.login, result.userInfo.name, result.userInfo.email, result.userInfo.avatar_url],
            (err) => {
              if (err) {
                console.error('Error saving user info:', err.message);
                reject(err);
              } else {
                console.log('User info saved to database');
                resolve();
              }
            });
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in GitHub authentication:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('completeWelcomeSetup', async () => {
    try {
      markSetupCompleted();
      return { success: true };
    } catch (error) {
      console.error('Error completing welcome setup:', error);
      return { success: false, error: error.message };
    }
  });

  // Node.js detection and installation handlers
  ipcMain.handle('checkNodeInstallation', async () => {
    try {
      const detectionResult = await detectNodeInstallation();
      return detectionResult;
    } catch (error) {
      console.error('Error checking Node.js installation:', error);
      return { 
        status: 'error',
        message: `Erro na detecção: ${error.message}`,
        needsInstallation: true,
        error: error.message
      };
    }
  });

  ipcMain.handle('installNodeDependencies', async (event, options = {}) => {
    try {
      console.log('🚀 Starting intelligent Node.js installation process...');
      console.log(`📋 Target version: ${NODE_VERSION}`);
      console.log(`📋 Platform: ${process.platform}`);
      console.log(`📋 User data path: ${app.getPath('userData')}`);
      
      // Clear any existing custom paths to start fresh
      customNodePath = null;
      customNpmPath = null;
      
      // Step 1: Intelligent installation (detect existing NVM or install new)
      console.log('🔧 Step 1: Intelligent Node.js installation...');
      const nodeResult = await installNodeJsIntelligently();
      if (!nodeResult.success) {
        throw new Error('Failed to install Node.js: ' + (nodeResult.error || 'Unknown error'));
      }
      console.log('✅ Node.js installation completed');
      console.log(`📍 Node.js path: ${nodeResult.nodePath}`);
      console.log(`📍 npm path: ${nodeResult.npmPath}`);
      console.log(`🔄 Used existing NVM: ${nodeResult.usedExistingNvm ? 'Yes' : 'No'}`);
      
      // Step 2: Configure paths
      console.log('⚙️ Step 2: Configuring environment paths...');
      const pathConfigured = configureNodePath();
      if (!pathConfigured) {
        console.warn('⚠️ Could not configure Node.js paths');
        throw new Error('Failed to configure Node.js environment paths');
      }
      console.log('✅ Environment paths configured');
      
      // Step 3: Verify installation
      console.log('🔍 Step 3: Verifying installation...');
      const verification = await verifyNodeInstallation();
      if (!verification.success) {
        throw new Error('Node.js installation verification failed: ' + verification.error);
      }
      console.log('✅ Installation verification completed');
      
      // Step 4: Final detection to confirm everything works
      console.log('🔍 Step 4: Final detection test...');
      const finalDetection = await detectNodeVersion();
      if (!finalDetection.installed || !finalDetection.valid) {
        throw new Error(`Final detection failed: installed=${finalDetection.installed}, valid=${finalDetection.valid}`);
      }
      
      console.log('🎉 Intelligent Node.js installation completed successfully!');
      console.log(`📊 Final status: v${finalDetection.version} (${finalDetection.isCustom ? 'custom' : 'system'})`);
      
      return {
        success: true,
        nodeVersion: verification.nodeVersion,
        npmVersion: verification.npmVersion,
        nodePath: verification.nodePath,
        npmPath: verification.npmPath,
        isCustom: finalDetection.isCustom,
        usedExistingNvm: nodeResult.usedExistingNvm || false
      };
    } catch (error) {
      console.error('❌ Error in intelligent Node.js installation:', error);
      console.error('📋 Error details:', {
        message: error.message,
        stack: error.stack,
        customNodePath: customNodePath,
        customNpmPath: customNpmPath
      });
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  ipcMain.handle('getNodeInstallationProgress', async () => {
    // This can be implemented later for real-time progress updates
    return {
      stage: 'ready',
      progress: 0,
      message: 'Ready to start installation'
    };
  });

  const toProjectResponse = (project) => ({
    id: project.id,
    projectName: project.name,
    githubUrl: project.githubUrl,
    projectPath: project.projectPath,
    repoFolderName: project.repoFolderName,
    createdAt: project.createdAt
  });

  ipcMain.handle('get-project-details', async (_event, projectId) => {
    try {
      const project = await projectService.getProjectDetails(projectId);
      return {
        projectName: project.name,
        githubUrl: project.githubUrl,
        projectPath: project.projectPath,
        repoFolderName: project.repoFolderName
      };
    } catch (error) {
      console.error('Error getting project details:', error);
      throw error.message || error;
    }
  });

  ipcMain.handle('get-recent-projects', async () => {
    try {
      const projects = await projectService.listRecentProjects(3);
      return projects.map(toProjectResponse);
    } catch (error) {
      console.error('Error getting recent projects:', error);
      throw error.message || error;
    }
  });

  ipcMain.handle('getAllProjects', async () => {
    try {
      console.log('Getting all projects from database...');
      const projects = await projectService.listAllProjects();
      console.log(`Found ${projects.length} projects`);
      return projects.map(toProjectResponse);
    } catch (error) {
      console.error('Error getting all projects:', error);
      throw error.message || error;
    }
  });

  ipcMain.handle('checkProjectExists', async (_event, folderPath) => {
    if (!fs.existsSync(folderPath)) {
      throw new Error('Pasta não encontrada');
    }

    const project = await projectService.findProjectByAbsolutePath(folderPath);
    if (project) {
      return { exists: true, projectId: project.id };
    }

    const folderInfo = await getFolderInfo(folderPath);
    return { exists: false, folderInfo };
  });

  ipcMain.handle('getFolderInfo', async (event, folderPath) => {
    try {
      const folderInfo = await getFolderInfo(folderPath);
      return folderInfo;
    } catch (error) {
      throw error;
    }
  });

  // Helper function to get folder information
  async function getFolderInfo(folderPath) {
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
          // Get remote URL using isomorphic-git
          remoteUrl = await gitGetRemoteUrl(folderPath);
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

  ipcMain.handle('save-project', async (_event, projectData) => {
    try {
      const project = await projectService.registerProject(projectData);
      console.log(`A project has been inserted with id ${project.id}`);
      return project.id;
    } catch (error) {
      console.error('Error saving project:', error);
      throw error.message || error;
    }
  });

  ipcMain.handle('reopen-project', async (event, projectId, projectPath, githubUrl, repoFolderName) => {
    console.log('🔧 DEBUG: reopen-project called for project:', projectId);
    return 'reopen-project-executed';
    const sendOutput = (output) => {
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('command-output', output);
        }
      });
    };

    const sendServerOutput = (output) => {
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('server-output', output);
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
      sendOutput('🔧 DEBUG: reopen-project - Construindo projeto...\n');
      await executeCommand('npm', ['run', 'build'], repoDirPath, `reopen-${projectId}`);
      sendOutput('Projeto construído.\n');
      sendStatus('success');
      await delay(3000);

      // Step 5: npm run dev (keep in background)
      sendServerOutput('Iniciando servidor de desenvolvimento...\n');

      let serverReady = false;
      const checkServerReady = (data) => {
        if (!serverReady && (data.includes('ready') || data.includes('compiled successfully') || data.includes('listening on'))) {
          serverReady = true;
          sendServerOutput('Servidor de desenvolvimento está pronto.\n');
          sendStatus('success');
        }
      };

      let devServerUrl = null;
      const urlRegex = /http:\/\/localhost:\d+\//;

      const processOutput = (data) => {
        const output = data.toString();
        sendServerOutput(output);
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
            if (hasDocumentalProcess(devProcess.pid)) {
              updateDocumentalProcess(devProcess.pid, { port });
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

      const devProcess = spawn(getNpmPath(), ['run', 'dev'], { cwd: repoDirPath });
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
        delete activeProcesses[`dev-open-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
        if (code !== 0) {
          sendServerOutput(`Servidor de desenvolvimento encerrado com código ${code}\n`);
          sendStatus('failure');
        }
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-open-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
        sendServerOutput(`Falha ao iniciar servidor de desenvolvimento: ${err.message}\n`);
        sendStatus('failure');
      });

      sendServerOutput('Servidor de desenvolvimento iniciado em segundo plano. Aguardando sinal de prontidão...\n');
    } catch (error) {
      sendOutput(`Erro durante a reabertura do projeto: ${error}\n`);
      sendStatus('failure');
    }
  });

  ipcMain.handle('open-project-only-preview-and-server', async (event, projectId, projectPath, githubUrl, repoFolderName) => {
    console.log('🔧 DEBUG: open-project-only-preview-and-server called for project:', projectId);
    const sendOutput = (output) => {
      console.log('🔧 DEBUG: sendOutput called with:', output);
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('command-output', output);
        }
      });
    };

    const sendServerOutput = (output) => {
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('server-output', output);
        }
      });
    };

    const sendStatus = (status) => {
      console.log('🔧 DEBUG: sendStatus called with:', status);
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

      // Step 1: ensure preview branch exists and checkout it
      sendOutput('🔧 DEBUG: open-project-only-preview-and-server - Verificando branch preview...\n');
      try {
        await gitEnsurePreviewBranch(repoDirPath);
        sendOutput('Branch preview verificada com sucesso.\n');
        sendStatus('success');
      } catch (error) {
        sendOutput(`Erro ao verificar branch preview: ${error.message}\n`);
        // Don't throw error for checkout failure, continue with server
        sendStatus('success');
      }
      await delay(3000);

      // Step 2: npm run dev (keep in background)
      sendServerOutput('Executando servidor do modo dev...\n');
      let serverReady = false;
      const checkServerReady = (data) => {
        if (!serverReady && (data.includes('ready') || data.includes('compiled successfully') || data.includes('listening on'))) {
          serverReady = true;
          sendServerOutput('Servidor de desenvolvimento está pronto.\n');
          sendStatus('success');
        }
      };

      let devServerUrl = null;
      const urlRegex = /http:\/\/localhost:\d+\//;

      const processOutput = (data) => {
        const output = data.toString();
        sendServerOutput(output);
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
            if (hasDocumentalProcess(devProcess.pid)) {
              updateDocumentalProcess(devProcess.pid, { port });
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

      const devProcess = spawn(getNpmPath(), ['run', 'dev'], { cwd: repoDirPath });
      activeProcesses[`dev-open-${projectId}`] = devProcess;

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
          sendServerOutput(`Servidor de desenvolvimento encerrado com código ${code}\n`);
          sendStatus('failure');
        }
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
        sendServerOutput(`Falha ao iniciar servidor de desenvolvimento: ${err.message}\n`);
        sendStatus('failure');
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-reopen-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
        sendServerOutput(`Falha ao iniciar servidor de desenvolvimento: ${err.message}\n`);
        sendStatus('failure');
      });

      sendServerOutput('Servidor de desenvolvimento iniciado em segundo plano. Aguardando sinal de prontidão...\n');
      console.log('🔧 DEBUG: open-project-only-preview-and-server completed successfully');
    } catch (error) {
      console.log('🔧 DEBUG: Error in open-project-only-preview-and-server:', error);
      sendOutput(`Erro durante a abertura do projeto: ${error}\n`);
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

    const sendServerOutput = (output) => {
      // Send to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('server-output', output);
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
        await projectService.setRepositoryFolder(projectId, folderName);
        
        sendOutput(`Using existing repository at ${repoDirPath}\n`);
        sendStatus('success');
        await delay(3000);
      } else if (isEmptyFolder) {
        // Clone directly into the empty folder
        repoDirPath = projectPath;
        const folderName = path.basename(projectPath);
        
        sendOutput('Cloning repository directly into selected folder...\n');
        try {
          await gitClone(githubUrl, repoDirPath);
          sendOutput(`Repository cloned into ${repoDirPath}\n`);
          sendStatus('success');
        } catch (error) {
          sendOutput(`Error cloning repository: ${error.message}\n`);
          throw error;
        }
        await delay(3000);

        // Update repoFolderName in DB
        await projectService.setRepositoryFolder(projectId, folderName);
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

        try {
          await gitClone(githubUrl, repoDirPath);
          sendOutput(`Repository cloned into ${repoDirPath}\n`);
          sendStatus('success');
        } catch (error) {
          sendOutput(`Error cloning repository: ${error.message}\n`);
          throw error;
        }
        await delay(3000);

        await projectService.setRepositoryFolder(projectId, finalRepoFolderName);
      }

      // Step 2: ensure preview branch exists and checkout it (skip if existing git repo)
      if (!isExistingGitRepo) {
        sendOutput('Checking out preview branch...\n');
        try {
          await gitEnsurePreviewBranch(repoDirPath);
          sendOutput('Checked out preview branch.\n');
          sendStatus('success');
        } catch (error) {
          sendOutput(`Error checking out preview branch: ${error.message}\n`);
          // Don't throw error for checkout failure, continue with setup
          sendStatus('success');
        }
        await delay(3000);
      } else {
        sendOutput('Skipping checkout for existing repository.\n');
        sendStatus('success');
        await delay(3000);
      }

      // Configure git user for this repository
      sendOutput('Configuring git user...\n');
      try {
        await configureGitForUser(repoDirPath);
        sendOutput('Git user configured successfully.\n');
      } catch (error) {
        sendOutput(`Warning: Could not configure git user: ${error.message}\n`);
      }

      // Step 3: npm install
      sendOutput('🔧 DEBUG: reopen-project - Installing dependencies...\n');
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
      sendServerOutput('Starting development server...\n');

      let serverReady = false;
      const checkServerReady = (data) => {
        if (!serverReady && (data.includes('ready') || data.includes('compiled successfully') || data.includes('listening on'))) {
          serverReady = true;
          sendServerOutput('Development server is ready.\n');
          sendStatus('success'); // Mark as success only when server is truly ready
        }
      };

      let devServerUrl = null;
      const urlRegex = /http:\/\/localhost:\d+\//;

      const processOutput = (data) => {
        const output = data.toString();
        sendServerOutput(output);
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
            if (hasDocumentalProcess(devProcess.pid)) {
              updateDocumentalProcess(devProcess.pid, { port });
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

      const devProcess = spawn(getNpmPath(), ['run', 'dev'], { cwd: repoDirPath });
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
          sendServerOutput(`Development server exited with code ${code}\n`);
          sendStatus('failure');
        }
      });

      devProcess.on('error', (err) => {
        delete activeProcesses[`dev-${projectId}`];
        if (devProcess.pid) {
          removeDocumentalProcess(devProcess.pid);
        }
        sendServerOutput(`Failed to start development server: ${err.message}\n`);
        sendStatus('failure');
      });

      sendServerOutput('Development server started in background. Waiting for readiness signal...\n');
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



  ipcMain.handle('remove-project', async (_event, projectId) => {
    try {
      console.log('Removing project:', projectId);
      const project = await projectService.getProjectDetails(projectId);
      const removed = await projectService.removeProject(projectId);

      if (!removed) {
        return { success: false, error: 'Project not found' };
      }

      if (project.repoFolderName && project.projectPath) {
        const repoDirPath = path.join(project.projectPath, project.repoFolderName);
        if (fs.existsSync(repoDirPath)) {
          try {
            fs.rmSync(repoDirPath, { recursive: true, force: true });
            console.log(`Repository folder ${repoDirPath} deleted.`);
          } catch (err) {
            console.error(`Error deleting repository folder ${repoDirPath}: ${err.message}`);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing project:', error);
      throw error.message || error;
    }
  });

  // Handler to get initial app logs
  ipcMain.handle('get-app-logs', async () => {
    return getAppLogs();
  });

  // Handler to clear console output
  ipcMain.on('clear-console-output', (event, type) => {
    console.log(`🧹 Clearing console output for type: ${type}`);
    
    switch (type) {
      case 'log':
        // Clear app log buffer
        appLogBuffer = [];
        console.log('✅ App log buffer cleared');
        break;
      case 'server':
        // Server output is handled per window, no central buffer to clear
        console.log('✅ Server output clear requested');
        break;
      case 'commands':
        // Command output is handled per window, no central buffer to clear
        console.log('✅ Command output clear requested');
        break;
      default:
        console.warn(`⚠️ Unknown console type to clear: ${type}`);
    }
  });

}

function handleActivate() {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}

// Handle app quit event - kill all processes before quitting
async function handleBeforeQuit() {
  console.log('🚪 App is quitting - killing all processes...');
  try {
    await killAllActiveProcesses();
    console.log('✅ All processes killed successfully');
  } catch (error) {
    console.error('❌ Error killing processes:', error);
  }
}

function handleWindowAllClosed() {
  // Clean up BrowserViews when all windows are closed
  windowBrowserViews.clear();
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

bootstrapApp({
  app,
  createWindow,
  initializeDatabase,
  registerHandlers: registerMainEventHandlers,
  onActivate: handleActivate,
  onBeforeQuit: handleBeforeQuit,
  onWindowAllClosed: handleWindowAllClosed
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

      // Branch management IPC handlers
      ipcMain.handle('git:list-branches', async (_event, projectId) => {
        try {
          return await gitWorkflowService.listBranches(projectId);
        } catch (error) {
          console.error('Error listing branches:', error);
          throw error.message || error;
        }
      });

      ipcMain.handle('git:create-branch', async (_event, projectId, branchName) => {
        try {
          await gitWorkflowService.createBranch(projectId, branchName);
          return { success: true };
        } catch (error) {
          console.error('Error creating branch:', error);
          throw error.message || error;
        }
      });

      ipcMain.handle('git:checkout-branch', async (_event, projectId, branchName) => {
        try {
          await gitWorkflowService.checkoutBranch(projectId, branchName);
          return { success: true };
        } catch (error) {
          console.error('Error checking out branch:', error);
          throw error.message || error;
        }
      });

      ipcMain.handle('git:get-current-branch', async (_event, projectId) => {
        try {
          return await gitWorkflowService.getCurrentBranch(projectId);
        } catch (error) {
          console.error('Error getting current branch:', error);
          throw error.message || error;
        }
      });

      ipcMain.handle('git:get-repository-info', async (_event, projectId) => {
        try {
          return await gitWorkflowService.getRepositoryInfo(projectId);
        } catch (error) {
          console.error('Error getting repository info:', error);
          throw error.message || error;
        }
      });

      ipcMain.handle('git:pull-from-preview', async (_event, projectId) => {
        try {
          return await gitWorkflowService.pullFromPreview(projectId);
        } catch (error) {
          console.error('Error pulling from preview:', error);
          throw error.message || error;
        }
      });

      ipcMain.handle('git:push-to-branch', async (_event, projectId, targetBranch) => {
        try {
          return await gitWorkflowService.pushToBranch(projectId, targetBranch);
        } catch (error) {
          console.error('Error pushing to branch:', error);
          throw error.message || error;
        }
      });

      ipcMain.handle('git:list-remote-branches', async (_event, projectId) => {
        try {
          return await gitWorkflowService.listRemoteBranches(projectId);
        } catch (error) {
          console.error('Error listing remote branches:', error);
          throw error.message || error;
        }
      });


      ipcMain.handle('open-file-explorer', async (event, dirPath) => {
        try {
          await shell.showItemInFolder(dirPath);
          return { success: true };
        } catch (error) {
          console.error('Error opening file explorer:', error);
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
