/**
 * @fileoverview Complete project creation handler
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { GitOperations } = require('./gitOperations.js');
const { ProcessManager } = require('./processManager.js');

/**
 * Project Creation Handler Class
 */
class ProjectCreationHandler {
  /**
   * Create an instance of ProjectCreationHandler
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.databaseManager - Database manager instance
   * @param {Object} dependencies.nodeDetectionService - Node.js detection service
   */
  constructor({ logger, databaseManager, nodeDetectionService }) {
    this.logger = logger;
    this.databaseManager = databaseManager;
    this.nodeDetectionService = nodeDetectionService;
    this.gitOps = new GitOperations({ logger });
    this.processManager = new ProcessManager({ logger, nodeDetectionService });
  }

  /**
   * Clone repository using isomorphic-git
   * @param {string} url - Repository URL
   * @param {string} dir - Target directory
   * @param {Function} sendOutput - Output callback
   * @returns {Promise<boolean>} Success status
   */
  async gitClone(url, dir, sendOutput) {
    try {
      this.logger.info(`Cloning repository from ${url} to ${dir}`);
      
      const token = await this.gitOps.getGitHubToken();
      const auth = token ? { username: token, password: 'x-oauth-basic' } : undefined;
      
      const git = require('isomorphic-git');
      const http = require('isomorphic-git/http/node');
      
      await git.clone({
        fs,
        http,
        dir,
        url,
        auth
      });
      
      this.logger.info(`Repository cloned successfully to ${dir}`);
      return true;
    } catch (error) {
      this.logger.error(`Error cloning repository:`, error);
      throw error;
    }
  }

  /**
   * Update repo folder name in database
   * @param {number} projectId - Project ID
   * @param {string} folderName - Folder name
   * @returns {Promise<void>}
   */
  async updateRepoFolderName(projectId, folderName) {
    try {
      const db = await this.databaseManager.getDatabase();
      
      return new Promise((resolve, reject) => {
        const self = this; // Preserve reference to class
        db.run(`UPDATE projects SET repoFolderName = ? WHERE id = ?`, [folderName, projectId], function (err) {
          if (err) {
            self.logger.error('Error updating repoFolderName:', err.message);
            reject(err.message);
          } else {
            self.logger.info(`repoFolderName updated for project ${projectId}`);
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error('Error in updateRepoFolderName:', error);
      throw error;
    }
  }

  /**
   * Start complete project creation process
   * @param {number} projectId - Project ID
   * @param {string} projectPath - Project path
   * @param {string} repoUrl - Repository URL
   * @param {boolean} isExistingGitRepo - Whether it's an existing git repo
   * @param {boolean} isEmptyFolder - Whether it's an empty folder
   * @returns {Promise<Object>} Result object
   */
  async startProjectCreation(projectId, projectPath, repoUrl, isExistingGitRepo = false, isEmptyFolder = false) {
    try {
      this.logger.info('Starting complete project creation:', { projectId, projectPath, repoUrl, isExistingGitRepo, isEmptyFolder });
      
      const sendOutput = (output) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('command-output', output);
          }
        });
      };

      const sendServerOutput = (output) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('server-output', output);
          }
        });
      };

      const sendStatus = (status) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('command-status', status);
          }
        });
      };

      let repoDirPath;
      
      if (isExistingGitRepo) {
        // Use existing folder
        repoDirPath = projectPath;
        const folderName = path.basename(projectPath);
        
        sendOutput(`📁 Using existing repository at ${repoDirPath}\n`);
        await this.updateRepoFolderName(projectId, folderName);
        sendStatus('success');
        await this.processManager.delay(3000);
        
      } else if (isEmptyFolder) {
        // Clone directly into empty folder
        repoDirPath = projectPath;
        const folderName = path.basename(projectPath);
        
        sendOutput('📥 Cloning repository directly into selected folder...\n');
        try {
          await this.gitClone(repoUrl, repoDirPath, sendOutput);
          sendOutput(`✅ Repository cloned into ${repoDirPath}\n`);
          sendStatus('success');
        } catch (error) {
          sendOutput(`❌ Error cloning repository: ${error.message}\n`);
          throw error;
        }
        await this.processManager.delay(3000);

        await this.updateRepoFolderName(projectId, folderName);
        
      } else {
        // Clone into new subfolder
        sendOutput('📥 Cloning repository...\n');
        const repoName = repoUrl.split('/').pop().replace('.git', '');
        let finalRepoFolderName = repoName;
        let counter = 0;
        while (fs.existsSync(path.join(projectPath, finalRepoFolderName))) {
          counter++;
          finalRepoFolderName = `${repoName}-${counter}`;
        }
        repoDirPath = path.join(projectPath, finalRepoFolderName);

        try {
          await this.gitClone(repoUrl, repoDirPath, sendOutput);
          sendOutput(`✅ Repository cloned into ${repoDirPath}\n`);
          sendStatus('success');
        } catch (error) {
          sendOutput(`❌ Error cloning repository: ${error.message}\n`);
          throw error;
        }
        await this.processManager.delay(3000);

        await this.updateRepoFolderName(projectId, finalRepoFolderName);
      }

      // Step 2: ensure preview branch exists and checkout it (skip if existing git repo)
      if (!isExistingGitRepo) {
        sendOutput('🔍 Checking out preview branch...\n');
        try {
          await this.gitOps.gitEnsurePreviewBranch(repoDirPath, sendOutput);
          sendOutput('✅ Preview branch checked out.\n');
          sendStatus('success');
        } catch (error) {
          sendOutput(`❌ Error checking out preview branch: ${error.message}\n`);
          // Don't throw error for checkout failure, continue with setup
          sendStatus('success');
        }
        await this.processManager.delay(3000);
      } else {
        sendOutput('⏭️ Skipping checkout for existing repository.\n');
        sendStatus('success');
        await this.processManager.delay(3000);
      }

      // Configure git user for this repository
      sendOutput('🔧 Configuring git user...\n');
      try {
        const configured = await this.gitOps.configureGitForUser(repoDirPath);
        if (configured) {
          sendOutput('✅ Git user configured successfully.\n');
        } else {
          sendOutput('⚠️ Could not configure git user, using default configuration.\n');
        }
      } catch (error) {
        sendOutput(`⚠️ Warning: Could not configure git user: ${error.message}\n`);
      }

      // Step 3: npm install
      sendOutput('📦 Installing dependencies...\n');
      try {
        await this.processManager.executeCommand('npm', ['install'], repoDirPath, projectId, sendOutput);
        sendOutput('✅ Dependencies installed.\n');
        sendStatus('success');
      } catch (error) {
        sendOutput(`❌ Error installing dependencies: ${error.message}\n`);
        throw error;
      }
      await this.processManager.delay(3000);

      // Step 4: npm run build
      sendOutput('🔨 Building project...\n');
      try {
        await this.processManager.executeCommand('npm', ['run', 'build'], repoDirPath, `build-${projectId}`, sendOutput);
        sendOutput('✅ Project built.\n');
        sendStatus('success');
      } catch (error) {
        sendOutput(`❌ Error building project: ${error.message}\n`);
        throw error;
      }
      await this.processManager.delay(3000);

      // Step 5: npm run dev (keep in background)
      sendServerOutput('🚀 Starting development server...\n');
      try {
        await this.processManager.startDevServer(repoDirPath, projectId, sendServerOutput, sendStatus);
      } catch (error) {
        sendOutput(`❌ Error starting development server: ${error.message}\n`);
        throw error;
      }

      return { success: true };
      
    } catch (error) {
      this.logger.error('Error in start-project-creation handler:', error);
      throw error;
    }
  }

  /**
   * Open project with preview branch check and dev server only
   * @param {number} projectId - Project ID
   * @param {string} projectPath - Project path
   * @param {string} repoUrl - Repository URL
   * @param {string} repoFolderName - Repository folder name
   * @returns {Promise<Object>} Result object
   */
  async openProjectOnlyPreviewAndServer(projectId, projectPath, repoUrl, repoFolderName) {
    try {
      this.logger.info('Opening project with preview and server only:', { projectId, projectPath, repoUrl, repoFolderName });
      
      const sendOutput = (output) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('command-output', output);
          }
        });
      };

      const sendServerOutput = (output) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('server-output', output);
          }
        });
      };

      const sendStatus = (status) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('command-status', status);
          }
        });
      };

      // For empty folders that were cloned directly, repoFolderName might be folder name itself
      let repoDirPath;
      if (repoFolderName && fs.existsSync(path.join(projectPath, repoFolderName))) {
        repoDirPath = path.join(projectPath, repoFolderName);
      } else {
        // Check if projectPath itself is repo (for empty folder case)
        if (fs.existsSync(path.join(projectPath, '.git'))) {
          repoDirPath = projectPath;
        } else {
          throw new Error('Repository folder not found');
        }
      }

      // Step 2: ensure preview branch exists and checkout it
      sendOutput('🔍 Verificando e garantindo branch preview...\n');
      try {
        await this.gitOps.gitEnsurePreviewBranch(repoDirPath, sendOutput);
        sendOutput('✅ Branch preview verificada.\n');
        sendStatus('success');
      } catch (error) {
        sendOutput(`❌ Erro ao verificar branch preview: ${error.message}\n`);
        // Don't throw error for checkout failure, continue with setup
        sendStatus('success');
      }
      await this.processManager.delay(3000);

      // Step 5: npm run dev (keep in background)
      sendServerOutput('🚀 Executando servidor do modo dev...\n');
      try {
        await this.processManager.startDevServer(repoDirPath, projectId, sendServerOutput, sendStatus);
      } catch (error) {
        sendOutput(`❌ Erro ao iniciar servidor de desenvolvimento: ${error.message}\n`);
        throw error;
      }

      return { success: true };
      
    } catch (error) {
      this.logger.error('Error in open-project-only-preview-and-server handler:', error);
      throw error;
    }
  }

  /**
   * Reopen existing project
   * @param {number} projectId - Project ID
   * @param {string} projectPath - Project path
   * @param {string} repoUrl - Repository URL
   * @param {string} repoFolderName - Repository folder name
   * @returns {Promise<Object>} Result object
   */
  async reopenProject(projectId, projectPath, repoUrl, repoFolderName) {
    try {
      this.logger.info('Reopening project:', { projectId, projectPath, repoUrl, repoFolderName });
      
      const sendOutput = (output) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('command-output', output);
          }
        });
      };

      const sendServerOutput = (output) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('server-output', output);
          }
        });
      };

      const sendStatus = (status) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('command-status', status);
          }
        });
      };

      // For empty folders that were cloned directly, repoFolderName might be folder name itself
      let repoDirPath;
      if (repoFolderName && fs.existsSync(path.join(projectPath, repoFolderName))) {
        repoDirPath = path.join(projectPath, repoFolderName);
      } else {
        // Check if projectPath itself is repo (for empty folder case)
        if (fs.existsSync(path.join(projectPath, '.git'))) {
          repoDirPath = projectPath;
        } else {
          throw new Error('Repository folder not found');
        }
      }

      // Step 4: npm run build
      sendOutput('🔨 Building project...\n');
      try {
        await this.processManager.executeCommand('npm', ['run', 'build'], repoDirPath, `reopen-${projectId}`, sendOutput);
        sendOutput('✅ Project built.\n');
        sendStatus('success');
      } catch (error) {
        sendOutput(`❌ Error building project: ${error.message}\n`);
        throw error;
      }
      await this.processManager.delay(3000);

      // Step5: npm run dev (keep in background)
      sendServerOutput('🚀 Starting development server...\n');
      try {
        await this.processManager.startDevServer(repoDirPath, projectId, sendServerOutput, sendStatus);
      } catch (error) {
        sendOutput(`❌ Error starting development server: ${error.message}\n`);
        throw error;
      }

      return { success: true };
      
    } catch (error) {
      this.logger.error('Error in reopen-project handler:', error);
      throw error;
    }
  }

  /**
   * Cancel project creation
   * @param {number} projectId - Project ID
   * @param {string} projectPath - Project path
   * @param {string} repoFolderName - Repository folder name
   * @returns {Promise<void>}
   */
  async cancelProjectCreation(projectId, projectPath, repoFolderName) {
    try {
      this.logger.info('Canceling project creation:', { projectId, projectPath, repoFolderName });
      
      const sendOutput = (output) => {
        // Send to all windows for synchronization
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('command-output', output);
          }
        });
      };

      await this.processManager.cancelProjectCreation(projectId, projectPath, repoFolderName, sendOutput);
      
    } catch (error) {
      this.logger.error('Error in cancel-project-creation handler:', error);
      throw error;
    }
  }

  /**
   * Get dev server URL from main process
   * @returns {string|null} Dev server URL
   */
  getDevServerUrl() {
    return this.processManager.getGlobalDevServerUrl();
  }

  /**
   * Register all project creation IPC handlers
   */
  registerHandlers() {
    this.logger.info('🚀 Registering project creation IPC handlers');

    /**
     * Start complete project creation
     */
    ipcMain.handle('start-project-creation', async (event, projectId, projectPath, repoUrl, isExistingGitRepo = false, isEmptyFolder = false) => {
      try {
        return await this.startProjectCreation(projectId, projectPath, repoUrl, isExistingGitRepo, isEmptyFolder);
      } catch (error) {
        this.logger.error('Error in start-project-creation handler:', error);
        throw error;
      }
    });

    /**
     * Open project with preview branch check and dev server only
     */
    ipcMain.handle('open-project-only-preview-and-server', async (event, projectId, projectPath, repoUrl, repoFolderName) => {
      try {
        return await this.openProjectOnlyPreviewAndServer(projectId, projectPath, repoUrl, repoFolderName);
      } catch (error) {
        this.logger.error('Error in open-project-only-preview-and-server handler:', error);
        throw error;
      }
    });

    /**
     * Reopen existing project
     */
    ipcMain.handle('reopen-project', async (event, projectId, projectPath, repoUrl, repoFolderName) => {
      try {
        return await this.reopenProject(projectId, projectPath, repoUrl, repoFolderName);
      } catch (error) {
        this.logger.error('Error in reopen-project handler:', error);
        throw error;
      }
    });

    /**
     * Cancel project creation
     */
    ipcMain.handle('cancel-project-creation', async (event, projectId, projectPath, repoFolderName) => {
      try {
        return await this.cancelProjectCreation(projectId, projectPath, repoFolderName);
      } catch (error) {
        this.logger.error('Error in cancel-project-creation handler:', error);
        throw error;
      }
    });



    this.logger.info('✅ Project creation IPC handlers registered');
  }

  /**
   * Unregister all project creation IPC handlers
   */
  unregisterHandlers() {
    this.logger.info('🚀 Unregistering project creation IPC handlers');
    
    ipcMain.removeHandler('start-project-creation');
    ipcMain.removeHandler('open-project-only-preview-and-server');
    ipcMain.removeHandler('reopen-project');
    ipcMain.removeHandler('cancel-project-creation');

    
    this.logger.info('✅ Project creation IPC handlers unregistered');
  }
}

module.exports = { ProjectCreationHandler };