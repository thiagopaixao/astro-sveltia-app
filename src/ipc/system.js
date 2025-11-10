/**
 * @fileoverview IPC handlers for system operations (dialogs, Node.js, file explorer)
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { ipcMain, app, dialog, shell, BrowserWindow } = require('electron');

/**
 * @typedef {Object} NodeDetectionResult
 * @property {string} status - Detection status ('installed', 'not_found', 'error')
 * @property {string} version - Node.js version if found
 * @property {string} path - Node.js executable path
 * @property {string} npmVersion - npm version if found
 * @property {string} npmPath - npm executable path
 * @property {boolean} needsInstallation - Whether Node.js needs to be installed
 * @property {string} [message] - Status message
 * @property {string} [error] - Error message if status is 'error'
 */

/**
 * @typedef {Object} InstallationProgress
 * @property {string} stage - Current installation stage
 * @property {number} progress - Progress percentage (0-100)
 * @property {string} message - Progress message
 */

/**
 * System Operations IPC Handlers
 */
class SystemHandlers {
  /**
   * Create an instance of SystemHandlers
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.windowManager - Window manager instance
   */
  constructor({ logger, windowManager }) {
    this.logger = logger;
    this.windowManager = windowManager;
    this.installationProgress = {
      stage: 'idle',
      progress: 0,
      message: 'Ready to start installation'
    };
  }

  /**
   * Get home directory path
   * @returns {string} Home directory path
   */
  getHomeDirectory() {
    return app.getPath('home');
  }

  /**
   * Open directory dialog
   * @returns {Promise<string|null>} Selected directory path or null if cancelled
   */
  async openDirectoryDialog() {
    if (!this.windowManager || !this.windowManager.hasValidMainWindow()) {
      this.logger.warn('⚠️ No valid main window for directory dialog');
      return null;
    }
    
    const { canceled, filePaths } = await dialog.showOpenDialog(
      this.windowManager.getMainWindow(),
      {
        properties: ['openDirectory']
      }
    );
    
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  }

  /**
   * Detect Node.js installation
   * @returns {Promise<NodeDetectionResult>} Node.js detection result
   */
  async detectNodeInstallation() {
    try {
      const { spawn } = require('child_process');
      const path = require('path');
      const os = require('os');
      
      return new Promise((resolve) => {
        const isWindows = os.platform() === 'win32';
        const nodeCmd = isWindows ? 'node.exe' : 'node';
        const npmCmd = isWindows ? 'npm.cmd' : 'npm';
        
        // Try to find Node.js in common locations
        const possiblePaths = [
          // System PATH
          nodeCmd,
          // Common installation paths
          isWindows ? [
            'C:\\Program Files\\nodejs\\node.exe',
            'C:\\Program Files (x86)\\nodejs\\node.exe',
            path.join(os.homedir(), 'AppData\\Local\\Programs\\nodejs\\node.exe'),
            path.join(os.homedir(), 'nvm\\current\\node.exe')
          ] : [
            '/usr/local/bin/node',
            '/usr/bin/node',
            path.join(os.homedir(), '.nvm', 'current', 'bin', 'node'),
            '/opt/homebrew/bin/node',
            path.join(os.homedir(), '.linuxbrew', 'bin', 'node')
          ]
        ].flat();

        let nodePath = null;
        let npmPath = null;
        let nodeVersion = null;
        let npmVersion = null;

        // Function to test if a command works
        const testCommand = (cmd, args = []) => {
          return new Promise((resolveTest) => {
            const child = spawn(cmd, args, { 
              stdio: ['ignore', 'pipe', 'ignore'],
              timeout: 5000,
              shell: true
            });
            
            let output = '';
            child.stdout.on('data', (data) => {
              output += data.toString();
            });
            
            child.on('close', (code) => {
              resolveTest({ success: code === 0, output: output.trim() });
            });
            
            child.on('error', () => {
              resolveTest({ success: false });
            });
          });
        };

        // Test Node.js
        const testNode = async () => {
          for (const testPath of possiblePaths) {
            const result = await testCommand(testPath, ['--version']);
            if (result.success) {
              nodePath = testPath;
              nodeVersion = result.output;
              return true;
            }
          }
          return false;
        };

        // Test npm
        const testNpm = async () => {
          const npmPaths = nodePath ? 
            [path.join(path.dirname(nodePath), npmCmd), npmCmd] : 
            [npmCmd];
          
          for (const testPath of npmPaths) {
            const result = await testCommand(testPath, ['--version']);
            if (result.success) {
              npmPath = testPath;
              npmVersion = result.output;
              return true;
            }
          }
          return false;
        };

        // Run tests
        (async () => {
          try {
            const nodeFound = await testNode();
            if (nodeFound) {
              await testNpm();
            }

            if (nodeFound && npmVersion) {
              resolve({
                status: 'installed',
                version: nodeVersion,
                path: nodePath,
                npmVersion,
                npmPath,
                needsInstallation: false,
                message: `Node.js ${nodeVersion} e npm ${npmVersion} encontrados`
              });
            } else if (nodeFound) {
              resolve({
                status: 'installed',
                version: nodeVersion,
                path: nodePath,
                npmVersion: 'Não encontrado',
                npmPath: null,
                needsInstallation: false,
                message: `Node.js ${nodeVersion} encontrado, mas npm não foi encontrado`
              });
            } else {
              resolve({
                status: 'not_found',
                version: null,
                path: null,
                npmVersion: null,
                npmPath: null,
                needsInstallation: true,
                message: 'Node.js não encontrado no sistema'
              });
            }
          } catch (error) {
            resolve({
              status: 'error',
              version: null,
              path: null,
              npmVersion: null,
              npmPath: null,
              needsInstallation: true,
              message: `Erro na detecção: ${error.message}`,
              error: error.message
            });
          }
        })();
      });
    } catch (error) {
      this.logger.error('Error detecting Node.js installation:', error);
      return {
        status: 'error',
        version: null,
        path: null,
        npmVersion: null,
        npmPath: null,
        needsInstallation: true,
        message: `Erro na detecção: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Install Node.js dependencies (placeholder implementation)
   * @param {Object} options - Installation options
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async installNodeDependencies(options = {}) {
    try {
      this.logger.info('🚀 Starting intelligent Node.js installation process...');
      
      // Update progress
      this.installationProgress = {
        stage: 'detecting',
        progress: 10,
        message: 'Detecting existing Node.js installation...'
      };
      
      // This is a placeholder implementation
      // In a real scenario, this would handle NVM detection, Node.js download, etc.
      throw new Error('Node.js installation not implemented yet');
      
    } catch (error) {
      this.logger.error('Error installing Node.js dependencies:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get Node.js installation progress
   * @returns {InstallationProgress} Current installation progress
   */
  getNodeInstallationProgress() {
    return { ...this.installationProgress };
  }

  /**
   * Get app logs
   * @returns {string} App logs
   */
  getAppLogs() {
    // This would get logs from the modular logger
    return this.logger.getLogs ? this.logger.getLogs() : '';
  }

  /**
   * Clear console output
   * @param {Object} event - IPC event object
   * @param {string} type - Type of console output to clear
   */
  clearConsoleOutput(event, type) {
    // Broadcast clear event to all windows
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('console-cleared', { type });
      }
    });
    
    this.logger.info(`Cleared ${type} console output`);
  }

  /**
   * Navigate to a specific page
   * @param {Object} event - IPC event object
   * @param {string} page - Page name to navigate to
   */
  navigate(event, page) {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      // This would use the window manager to navigate
      this.logger.info(`Navigating to page: ${page}`);
    }
  }

  /**
   * Get dev server URL from main process
   * @returns {string|null} Dev server URL
   */
  getDevServerUrlFromMain() {
    this.logger.info('📡 get-dev-server-url-from-main called');
    // This would return the global dev server URL
    return null; // Placeholder
  }

  /**
   * Confirm app exit
   * @param {Object} event - IPC event object
   * @returns {Promise<boolean>} Whether user confirmed exit
   */
  async confirmExitApp(event) {
    const window = BrowserWindow.fromWebContents(event.sender);
    this.logger.info('🚪 Exit confirmation requested from window:', window?.id);
    
    return new Promise((resolve) => {
      if (window && !window.isDestroyed()) {
        // Send request to renderer to show confirmation dialog
        this.logger.info('📤 Sending show-exit-confirmation to renderer');
        window.webContents.send('show-exit-confirmation');
        
        // Listen for response
        const handleResponse = (event, confirmed) => {
          ipcMain.removeListener('exit-confirmation-response', handleResponse);
          this.logger.info('🚪 Exit confirmation response received:', confirmed);
          
          if (confirmed) {
            this.logger.info('🚪 User confirmed exit - quitting app');
            app.quit();
          }
          
          resolve(confirmed);
        };
        
        ipcMain.once('exit-confirmation-response', handleResponse);
        
        // Fallback timeout
        setTimeout(() => {
          ipcMain.removeListener('exit-confirmation-response', handleResponse);
          resolve(false);
        }, 30000);
      } else {
        resolve(false);
      }
    });
  }

  /**
   * Open file explorer at specific directory
   * @param {string} dirPath - Directory path to show
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async openFileExplorer(dirPath) {
    try {
      await shell.showItemInFolder(dirPath);
      return { success: true };
    } catch (error) {
      this.logger.error('Error opening file explorer:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register all system operations IPC handlers
   */
  registerHandlers() {
    this.logger.info('⚙️ Registering system operations IPC handlers');

    /**
     * Get home directory
     */
    ipcMain.handle('get-home-directory', () => {
      return this.getHomeDirectory();
    });

    /**
     * Open directory dialog
     */
    ipcMain.handle('open-directory-dialog', async () => {
      return await this.openDirectoryDialog();
    });

    /**
     * Check Node.js installation
     */
    ipcMain.handle('checkNodeInstallation', async () => {
      try {
        const detectionResult = await this.detectNodeInstallation();
        return detectionResult;
      } catch (error) {
        this.logger.error('Error checking Node.js installation:', error);
        return { 
          status: 'error',
          message: `Erro na detecção: ${error.message}`,
          needsInstallation: true,
          error: error.message
        };
      }
    });

    /**
     * Install Node.js dependencies
     */
    ipcMain.handle('installNodeDependencies', async (event, options = {}) => {
      return await this.installNodeDependencies(options);
    });

    /**
     * Get Node.js installation progress
     */
    ipcMain.handle('getNodeInstallationProgress', async () => {
      return this.getNodeInstallationProgress();
    });

    /**
     * Get app logs
     */
    ipcMain.handle('get-app-logs', async () => {
      return this.getAppLogs();
    });

    /**
     * Clear console output
     */
    ipcMain.on('clear-console-output', (event, type) => {
      this.clearConsoleOutput(event, type);
    });

    /**
     * Navigate to page
     */
    ipcMain.on('navigate', (event, page) => {
      this.navigate(event, page);
    });

    /**
     * Get dev server URL
     */
    ipcMain.handle('get-dev-server-url-from-main', () => {
      return this.getDevServerUrlFromMain();
    });

    /**
     * Confirm app exit
     */
    ipcMain.handle('confirm-exit-app', async (event) => {
      return await this.confirmExitApp(event);
    });

    /**
     * Open file explorer
     */
    ipcMain.handle('open-file-explorer', async (event, dirPath) => {
      return await this.openFileExplorer(dirPath);
    });

    this.logger.info('✅ System operations IPC handlers registered');
  }

  /**
   * Unregister all system operations IPC handlers
   */
  unregisterHandlers() {
    this.logger.info('⚙️ Unregistering system operations IPC handlers');
    
    ipcMain.removeHandler('get-home-directory');
    ipcMain.removeHandler('open-directory-dialog');
    ipcMain.removeHandler('checkNodeInstallation');
    ipcMain.removeHandler('installNodeDependencies');
    ipcMain.removeHandler('getNodeInstallationProgress');
    ipcMain.removeHandler('get-app-logs');
    ipcMain.removeListener('clear-console-output');
    ipcMain.removeListener('navigate');
    ipcMain.removeHandler('get-dev-server-url-from-main');
    ipcMain.removeHandler('confirm-exit-app');
    ipcMain.removeHandler('open-file-explorer');
    
    this.logger.info('✅ System operations IPC handlers unregistered');
  }
}

module.exports = { SystemHandlers };