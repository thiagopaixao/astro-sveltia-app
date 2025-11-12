/**
 * @fileoverview Process management for project operations
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { spawn } = require('child_process');
const { execa } = require('execa');
const fs = require('fs');
const path = require('path');
const { PlatformService } = require('../main/services/platform/PlatformService');

// Global state
let globalDevServerUrl = null;
let activeProcesses = {};
let activeDocumentalProcesses = {};

/**
 * Process Manager Class
 */
class ProcessManager {
  /**
   * Create an instance of ProcessManager
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.nodeDetectionService - Node.js detection service
   */
  constructor({ logger, nodeDetectionService }) {
    this.logger = logger;
    this.nodeDetectionService = nodeDetectionService;
    this.platformService = new PlatformService({ logger });
    this.processesFile = this.platformService.joinPath(this.platformService.getHomeDirectory(), '.documental-processes.json');
    this.loadDocumentalProcesses();
  }

  /**
   * Load Documental processes from file
   * @returns {Object} Processes object
   */
  loadDocumentalProcesses() {
    try {
      if (fs.existsSync(this.processesFile)) {
        const data = fs.readFileSync(this.processesFile, 'utf8');
        const processes = JSON.parse(data);
        this.logger.info('Loaded Documental processes from file:', Object.keys(processes));
        activeDocumentalProcesses = processes;
        return processes;
      }
    } catch (error) {
      this.logger.error('Error loading Documental processes:', error);
    }
    return {};
  }

  /**
   * Save Documental processes to file
   */
  saveDocumentalProcesses() {
    try {
      fs.writeFileSync(this.processesFile, JSON.stringify(activeDocumentalProcesses, null, 2));
      this.logger.info('Saved Documental processes to file');
    } catch (error) {
      this.logger.error('Error saving Documental processes:', error);
    }
  }

  /**
   * Add Documental process to tracking
   * @param {number} pid - Process ID
   * @param {Object} processInfo - Process information
   */
  addDocumentalProcess(pid, processInfo) {
    activeDocumentalProcesses[pid] = {
      pid,
      port: processInfo.port,
      projectId: processInfo.projectId,
      startTime: Date.now(),
      command: processInfo.command,
      cwd: processInfo.cwd
    };
    this.saveDocumentalProcesses();
    this.logger.info(`Added Documental process to tracking: PID ${pid}, Port ${processInfo.port}`);
  }

  /**
   * Remove Documental process from tracking
   * @param {number} pid - Process ID
   */
  removeDocumentalProcess(pid) {
    if (activeDocumentalProcesses[pid]) {
      delete activeDocumentalProcesses[pid];
      this.saveDocumentalProcesses();
      this.logger.info(`Removed Documental process from tracking: PID ${pid}`);
    }
  }

  /**
   * Get npm path
   * @returns {Promise<string>} npm executable path
   */
  async getNpmPath() {
    try {
      // Always prefer custom npm path if available
      if (process.env.CUSTOM_NPM_PATH) {
        this.logger.info(`Using custom npm path: ${process.env.CUSTOM_NPM_PATH}`);
        return process.env.CUSTOM_NPM_PATH;
      }
      
      // Use Node.js detection service to get preferred npm
      if (this.nodeDetectionService) {
        const npmPath = await this.nodeDetectionService.getPreferredNpmExecutable();
        this.logger.info(`Using detected npm path: ${npmPath}`);
        return npmPath;
      }
      
      this.logger.info('Using system npm');
      return 'npm';
    } catch (error) {
      this.logger.warn('Failed to get npm path from detection service, falling back to system npm:', error.message);
      return 'npm';
    }
  }

  /**
   * Get Node.js path
   * @returns {Promise<string>} Node.js executable path
   */
  async getNodePath() {
    try {
      // Always prefer custom node path if available
      if (process.env.CUSTOM_NODE_PATH) {
        this.logger.info(`Using custom node path: ${process.env.CUSTOM_NODE_PATH}`);
        return process.env.CUSTOM_NODE_PATH;
      }
      
      // Use Node.js detection service to get preferred node
      if (this.nodeDetectionService) {
        const nodePath = await this.nodeDetectionService.getPreferredNodeExecutable();
        this.logger.info(`Using detected node path: ${nodePath}`);
        return nodePath;
      }
      
      this.logger.info('Using system node');
      return 'node';
    } catch (error) {
      this.logger.warn('Failed to get node path from detection service, falling back to system node:', error.message);
      return 'node';
    }
  }

  /**
   * Extract port from URL
   * @param {string} url - URL string
   * @returns {number|null} Port number or null
   */
  extractPortFromUrl(url) {
    const match = url.match(/http:\/\/localhost:(\d+)\//);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Create delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a command in a directory
   * @param {string} command - Command to execute
   * @param {Array<string>} args - Command arguments
   * @param {string} cwd - Working directory
   * @param {string} processId - Process ID for tracking
   * @param {Function} sendOutput - Output callback
   * @returns {Promise<void>}
   */
  executeCommand(command, args, cwd, processId, sendOutput) {
    return new Promise(async (resolve, reject) => {
      let actualCommand = command;
      let env = { ...process.env };

      // Check if we should use embedded Node.js/NPM
      if (command === 'node' || command === 'npm' || command === 'npx') {
        try {
          const detection = await this.nodeDetectionService.detectNodeInstallation();
          
          if (detection.recommendation === 'use_embedded' && detection.embeddedNode) {
            this.logger.info(`📦 Using embedded ${command} for process ${processId}`);
            
            if (command === 'node') {
              actualCommand = detection.embeddedNode.path;
            } else if (command === 'npm') {
              actualCommand = this.nodeDetectionService.getEmbeddedNpmPath();
            } else if (command === 'npx') {
              actualCommand = this.nodeDetectionService.getEmbeddedNpxPath();
            }

            // Set environment variables for embedded Node.js
            const embeddedNodePath = path.dirname(detection.embeddedNode.path);
            env.PATH = this.platformService.joinPath(embeddedNodePath, '') + this.platformService.getPathSeparator() + env.PATH;
            
            // Ensure Node.js can find its modules
            env.NODE_PATH = this.platformService.joinPath(path.dirname(detection.embeddedNode.path), '..', 'lib', 'node_modules');
          }
        } catch (error) {
          this.logger.warn(`⚠️ Could not detect embedded Node.js for ${command}, falling back to system: ${error.message}`);
        }
      }

      this.logger.info(`🚀 Executing: ${actualCommand} ${args.join(' ')} in ${cwd}`);

      try {
        const subprocess = execa(actualCommand, args, {
          cwd,
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        activeProcesses[processId] = subprocess;

        // Handle stdout
        subprocess.stdout?.on('data', (data) => {
          sendOutput(data.toString());
        });

        // Handle stderr
        subprocess.stderr?.on('data', (data) => {
          sendOutput(data.toString());
        });

        // Handle process completion
        subprocess.on('exit', (code, signal) => {
          delete activeProcesses[processId];
          if (code === 0) {
            resolve();
          } else if (signal) {
            reject(`Command killed with signal: ${signal}`);
          } else {
            reject(`Command failed with code ${code}`);
          }
        });

        // Handle process errors
        subprocess.on('error', (err) => {
          delete activeProcesses[processId];
          reject(`Failed to start command: ${err.message}`);
        });

      } catch (error) {
        delete activeProcesses[processId];
        reject(`Failed to execute command: ${error.message}`);
      }
    });
  }

  /**
   * Start development server with URL detection
   * @param {string} repoDirPath - Repository directory path
   * @param {number} projectId - Project ID
   * @param {Function} sendServerOutput - Server output callback
   * @param {Function} sendStatus - Status callback
   * @returns {Promise<Object>} Process information
   */
  async startDevServer(repoDirPath, projectId, sendServerOutput, sendStatus) {
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
          
          // Extract port and update tracked Documental process
          const port = this.extractPortFromUrl(devServerUrl);
          if (port && devProcess.pid) {
            // Update process with port information
            if (activeDocumentalProcesses[devProcess.pid]) {
              activeDocumentalProcesses[devProcess.pid].port = port;
              this.saveDocumentalProcesses();
              this.logger.info(`Updated Documental process ${devProcess.pid} with port ${port}`);
            }
          }
          
          this.logger.info(`Development server URL: ${devServerUrl}`);
          // Send to all windows for synchronization
          const { BrowserWindow } = require('electron');
          const allWindows = BrowserWindow.getAllWindows();
          this.logger.info(`Sending dev-server-url to ${allWindows.length} windows`);
          BrowserWindow.getAllWindows().forEach(window => {
            if (!window.isDestroyed()) {
              this.logger.info(`Sending to window: ${window.id}`);
              window.webContents.send('dev-server-url', devServerUrl);
            }
          });
        }
      }
    };

    // Use executeCommand to ensure embedded Node.js/NPM is used
    let devProcess;
    let processStarted = false;
    
    try {
      // Create a custom spawn to handle the dev server process
      const { spawn } = require('child_process');
      
      // Get the proper npm path using the same logic as executeCommand
      let actualNpmPath = 'npm';
      let env = { ...process.env };

      // Check if we should use embedded Node.js/NPM
      try {
        const detection = await this.nodeDetectionService.detectNodeInstallation();
        
        if (detection.recommendation === 'use_embedded' && detection.embeddedNode) {
          this.logger.info(`📦 Using embedded npm for dev server ${projectId}`);
          actualNpmPath = this.nodeDetectionService.getEmbeddedNpmPath();

          // Set environment variables for embedded Node.js
          const embeddedNodePath = path.dirname(detection.embeddedNode.path);
          env.PATH = this.platformService.joinPath(embeddedNodePath, '') + this.platformService.getPathSeparator() + env.PATH;
          
          // Ensure Node.js can find its modules
          env.NODE_PATH = this.platformService.joinPath(path.dirname(detection.embeddedNode.path), '..', 'lib', 'node_modules');
        }
      } catch (error) {
        this.logger.warn(`⚠️ Could not detect embedded Node.js for dev server, falling back to system: ${error.message}`);
      }

      this.logger.info(`🚀 Starting dev server: ${actualNpmPath} run dev in ${repoDirPath}`);

      try {
        devProcess = execa(actualNpmPath, ['run', 'dev'], { 
          cwd: repoDirPath,
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        processStarted = true;
        activeProcesses[`dev-${projectId}`] = devProcess;

        // Track this as a Documental process
        if (devProcess.pid) {
          this.addDocumentalProcess(devProcess.pid, {
            port: null, // Will be updated when URL is detected
            projectId: projectId,
            command: 'npm run dev',
            cwd: repoDirPath
          });
        }

        // Handle stdout
        devProcess.stdout?.on('data', processOutput);
        
        // Handle stderr
        devProcess.stderr?.on('data', processOutput);

        // Handle process completion
        devProcess.on('exit', (code, signal) => {
          delete activeProcesses[`dev-${projectId}`];
          if (devProcess.pid) {
            this.removeDocumentalProcess(devProcess.pid);
          }
          if (signal) {
            sendServerOutput(`Development server killed with signal: ${signal}\n`);
            sendStatus('failure');
          } else if (code !== 0) {
            sendServerOutput(`Development server exited with code ${code}\n`);
            sendStatus('failure');
          }
        });

        // Handle process errors
        devProcess.on('error', (err) => {
          delete activeProcesses[`dev-${projectId}`];
          if (devProcess.pid) {
            this.removeDocumentalProcess(devProcess.pid);
          }
          sendServerOutput(`Failed to start development server: ${err.message}\n`);
          sendStatus('failure');
        });

      } catch (error) {
        sendServerOutput(`Failed to start development server: ${error.message}\n`);
        sendStatus('failure');
      }

    } catch (error) {
      sendServerOutput(`Failed to start development server: ${error.message}\n`);
      sendStatus('failure');
    }

    sendServerOutput('Development server started in background. Waiting for readiness signal...\n');
    
    return {
      process: devProcess,
      url: devServerUrl
    };
  }

  /**
   * Get global dev server URL
   * @returns {string|null} Global dev server URL
   */
  getGlobalDevServerUrl() {
    this.logger.info('get-dev-server-url-from-main called, returning:', globalDevServerUrl);
    return globalDevServerUrl;
  }

  /**
   * Set global dev server URL
   * @param {string} url - Dev server URL
   */
  setGlobalDevServerUrl(url) {
    globalDevServerUrl = url;
    this.logger.info('Global dev server URL set to:', url);
  }

  /**
   * Get active processes
   * @returns {Object} Active processes object
   */
  getActiveProcesses() {
    return activeProcesses;
  }

  /**
   * Get active Documental processes
   * @returns {Object} Active Documental processes object
   */
  getActiveDocumentalProcesses() {
    return activeDocumentalProcesses;
  }

  /**
   * Kill process by ID
   * @param {string} processId - Process ID
   * @returns {Promise<boolean>} Success status
   */
  async killProcess(processId) {
    try {
      const process = activeProcesses[processId];
      if (process && !process.killed) {
        // Use platform-specific signals
        const signal = this.platformService.getTerminationSignal();
        process.kill(signal);
        process.killed = true;
        
        // Wait a bit and force kill if still running
        setTimeout(() => {
          if (!process.killed) {
            const forceSignal = this.platformService.getForceTerminationSignal();
            process.kill(forceSignal);
          }
        }, 5000);
        
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error killing process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Cancel project creation and clean up
   * @param {number} projectId - Project ID
   * @param {string} projectPath - Project path
   * @param {string} repoFolderName - Repository folder name
   * @param {Function} sendOutput - Output callback
   * @returns {Promise<void>}
   */
  async cancelProjectCreation(projectId, projectPath, repoFolderName, sendOutput) {
    try {
      // Terminate active processes for this project
      if (activeProcesses[projectId]) {
        const process = activeProcesses[projectId];
        if (process.pid) {
          this.removeDocumentalProcess(process.pid);
        }
        delete activeProcesses[projectId];
      }
      
      if (activeProcesses[`dev-${projectId}`]) {
        const process = activeProcesses[`dev-${projectId}`];
        if (process.pid) {
          this.removeDocumentalProcess(process.pid);
        }
        delete activeProcesses[`dev-${projectId}`];
      }

      // Clean up repository folder if it exists
      if (repoFolderName) {
        const repoPath = path.join(projectPath, repoFolderName);
        if (fs.existsSync(repoPath)) {
          sendOutput(`🗑️ Removing repository folder: ${repoPath}\n`);
          const rimraf = require('rimraf');
          await rimraf(repoPath);
          sendOutput(`✅ Repository folder removed successfully\n`);
        }
      }
    } catch (error) {
      this.logger.error('Error canceling project creation:', error);
      throw error;
    }
  }
}

module.exports = { ProcessManager };