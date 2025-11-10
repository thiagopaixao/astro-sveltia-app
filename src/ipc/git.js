/**
 * @fileoverview IPC handlers for Git operations
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { ipcMain } = require('electron');
const path = require('path');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

/**
 * @typedef {Object} GitOperationResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} [error] - Error message if operation failed
 * @property {*} [data] - Operation result data
 */

/**
 * @typedef {Object} BranchInfo
 * @property {string} name - Branch name
 * @property {boolean} isCurrent - Whether this is the current branch
 * @property {boolean} isRemote - Whether this is a remote branch
 */

/**
 * @typedef {Object} RepositoryInfo
 * @property {string} currentBranch - Current branch name
 * @property {Array<string>} branches - List of local branches
 * @property {Array<string>} remoteBranches - List of remote branches
 * @property {string|null} remoteUrl - Remote repository URL
 * @property {boolean} isClean - Whether working directory is clean
 * @property {string|null} status - Git status information
 */

/**
 * Git Operations IPC Handlers
 */
class GitHandlers {
  /**
   * Create an instance of GitHandlers
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.databaseManager - Database manager instance
   */
  constructor({ logger, databaseManager }) {
    this.logger = logger;
    this.databaseManager = databaseManager;
  }

  /**
   * Get project path by ID
   * @param {number} projectId - Project ID
   * @returns {Promise<string>} Full project path
   */
  async getProjectPath(projectId) {
    const db = await this.databaseManager.getDatabase();
    
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          reject(new Error('Project not found'));
          return;
        }

        // Validate required fields
        if (!row.projectPath || !row.repoFolderName) {
          reject(new Error(`Invalid project data: projectPath=${row.projectPath}, repoFolderName=${row.repoFolderName}`));
          return;
        }

        const projectPath = path.join(row.projectPath, row.repoFolderName);
        resolve(projectPath);
      });
    });
  }

  /**
   * List all branches in the repository
   * @param {string} projectPath - Path to the git repository
   * @returns {Promise<{branches: Array<BranchInfo>, current: string}>}
   */
  async gitListBranches(projectPath) {
    try {
      // Get current branch
      const currentBranch = await git.currentBranch({ fs: require('fs'), dir: projectPath });
      
      // List all references (branches)
      const refs = await git.listRefs({ fs: require('fs'), dir: projectPath });
      
      const branches = [];
      const remoteBranches = [];
      
      for (const ref of refs) {
        if (ref.startsWith('refs/heads/')) {
          const branchName = ref.replace('refs/heads/', '');
          branches.push({
            name: branchName,
            isCurrent: branchName === currentBranch,
            isRemote: false
          });
        } else if (ref.startsWith('refs/remotes/')) {
          const branchName = ref.replace('refs/remotes/origin/', '');
          if (branchName !== 'HEAD') {
            remoteBranches.push({
              name: branchName,
              isCurrent: false,
              isRemote: true
            });
          }
        }
      }
      
      return {
        branches: branches.concat(remoteBranches),
        current: currentBranch
      };
    } catch (error) {
      this.logger.error('Error listing branches:', error);
      throw error;
    }
  }

  /**
   * Create a new branch
   * @param {string} projectPath - Path to the git repository
   * @param {string} branchName - Name of the branch to create
   * @returns {Promise<void>}
   */
  async gitCreateBranch(projectPath, branchName) {
    try {
      await git.branch({
        fs: require('fs'),
        dir: projectPath,
        ref: branchName
      });
      
      this.logger.info(`Created branch: ${branchName}`);
    } catch (error) {
      this.logger.error('Error creating branch:', error);
      throw error;
    }
  }

  /**
   * Checkout to a specific branch
   * @param {string} projectPath - Path to the git repository
   * @param {string} branchName - Name of the branch to checkout
   * @returns {Promise<void>}
   */
  async gitCheckoutBranch(projectPath, branchName) {
    try {
      await git.checkout({
        fs: require('fs'),
        dir: projectPath,
        ref: branchName
      });
      
      this.logger.info(`Checked out branch: ${branchName}`);
    } catch (error) {
      this.logger.error('Error checking out branch:', error);
      throw error;
    }
  }

  /**
   * Get current branch name
   * @param {string} projectPath - Path to the git repository
   * @returns {Promise<string>} Current branch name
   */
  async gitGetCurrentBranch(projectPath) {
    try {
      const currentBranch = await git.currentBranch({ fs: require('fs'), dir: projectPath });
      return currentBranch;
    } catch (error) {
      this.logger.error('Error getting current branch:', error);
      throw error;
    }
  }

  /**
   * Get repository information
   * @param {string} projectPath - Path to the git repository
   * @returns {Promise<RepositoryInfo>} Repository information
   */
  async gitGetRepositoryInfo(projectPath) {
    try {
      const currentBranch = await git.currentBranch({ fs: require('fs'), dir: projectPath });
      
      // Get branches
      const { branches, remoteBranches } = await this.gitListBranches(projectPath);
      const localBranches = branches.filter(b => !b.isRemote);
      
      // Get remote URL
      let remoteUrl = null;
      try {
        remoteUrl = await git.getConfig({
          fs: require('fs'),
          dir: projectPath,
          path: 'remote.origin.url'
        });
      } catch (error) {
        this.logger.debug('Could not get remote URL:', error.message);
      }
      
      // Get status
      let isClean = true;
      let status = null;
      try {
        const statusResult = await git.statusMatrix({
          fs: require('fs'),
          dir: projectPath
        });
        
        // Check if there are any unstaged changes
        isClean = statusResult.every(row => row[1] === row[2]);
        status = isClean ? 'clean' : 'dirty';
      } catch (error) {
        this.logger.debug('Could not get status:', error.message);
      }
      
      return {
        currentBranch,
        branches: localBranches.map(b => b.name),
        remoteBranches: remoteBranches.map(b => b.name),
        remoteUrl,
        isClean,
        status
      };
    } catch (error) {
      this.logger.error('Error getting repository info:', error);
      throw error;
    }
  }

  /**
   * Pull changes from remote (preview branch)
   * @param {string} projectPath - Path to the git repository
   * @returns {Promise<{pulled: boolean, changes: number}>}
   */
  async gitPullFromPreview(projectPath) {
    try {
      // Get current branch to switch back to it later
      const currentBranch = await git.currentBranch({ fs: require('fs'), dir: projectPath });
      
      // Switch to preview branch
      await git.checkout({
        fs: require('fs'),
        dir: projectPath,
        ref: 'preview'
      });
      
      // Pull from remote
      await git.pull({
        fs: require('fs'),
        http,
        dir: projectPath,
        ref: 'preview',
        singleBranch: true
      });
      
      // Switch back to original branch
      await git.checkout({
        fs: require('fs'),
        dir: projectPath,
        ref: currentBranch
      });
      
      this.logger.info('Pulled changes from preview branch');
      return { pulled: true, changes: 0 }; // TODO: Count actual changes
    } catch (error) {
      this.logger.error('Error pulling from preview:', error);
      throw error;
    }
  }

  /**
   * Push changes to a specific branch
   * @param {string} projectPath - Path to the git repository
   * @param {string} targetBranch - Target branch name
   * @returns {Promise<{pushed: boolean, changes: number}>}
   */
  async gitPushToBranch(projectPath, targetBranch) {
    try {
      // Push to target branch
      await git.push({
        fs: require('fs'),
        http,
        dir: projectPath,
        ref: targetBranch
      });
      
      this.logger.info(`Pushed changes to branch: ${targetBranch}`);
      return { pushed: true, changes: 0 }; // TODO: Count actual changes
    } catch (error) {
      this.logger.error('Error pushing to branch:', error);
      throw error;
    }
  }

  /**
   * List remote branches
   * @param {string} projectPath - Path to the git repository
   * @returns {Promise<Array<string>>} List of remote branch names
   */
  async gitListRemoteBranches(projectPath) {
    try {
      const refs = await git.listServerRefs({
        http,
        url: await git.getConfig({
          fs: require('fs'),
          dir: projectPath,
          path: 'remote.origin.url'
        })
      });
      
      const branches = refs
        .filter(ref => ref.ref.startsWith('refs/heads/'))
        .map(ref => ref.ref.replace('refs/heads/', ''))
        .filter(name => name !== 'HEAD');
      
      return branches;
    } catch (error) {
      this.logger.error('Error listing remote branches:', error);
      throw error;
    }
  }

  /**
   * Register all Git operations IPC handlers
   */
  registerHandlers() {
    this.logger.info('🔧 Registering Git operations IPC handlers');

    /**
     * List branches
     */
    ipcMain.handle('git:list-branches', async (event, projectId) => {
      try {
        const projectPath = await this.getProjectPath(projectId);
        const result = await this.gitListBranches(projectPath);
        return { success: true, ...result };
      } catch (error) {
        this.logger.error('Error in git:list-branches handler:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * Create branch
     */
    ipcMain.handle('git:create-branch', async (event, projectId, branchName) => {
      try {
        const projectPath = await this.getProjectPath(projectId);
        await this.gitCreateBranch(projectPath, branchName);
        return { success: true, branchName };
      } catch (error) {
        this.logger.error('Error in git:create-branch handler:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * Checkout branch
     */
    ipcMain.handle('git:checkout-branch', async (event, projectId, branchName) => {
      try {
        const projectPath = await this.getProjectPath(projectId);
        await this.gitCheckoutBranch(projectPath, branchName);
        return { success: true, branchName };
      } catch (error) {
        this.logger.error('Error in git:checkout-branch handler:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * Get current branch
     */
    ipcMain.handle('git:get-current-branch', async (event, projectId) => {
      try {
        const projectPath = await this.getProjectPath(projectId);
        const currentBranch = await this.gitGetCurrentBranch(projectPath);
        return { success: true, currentBranch };
      } catch (error) {
        this.logger.error('Error in git:get-current-branch handler:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * Get repository info
     */
    ipcMain.handle('git:get-repository-info', async (event, projectId) => {
      try {
        const projectPath = await this.getProjectPath(projectId);
        const repoInfo = await this.gitGetRepositoryInfo(projectPath);
        return { success: true, ...repoInfo };
      } catch (error) {
        this.logger.error('Error in git:get-repository-info handler:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * Pull from preview branch
     */
    ipcMain.handle('git:pull-from-preview', async (event, projectId) => {
      try {
        const projectPath = await this.getProjectPath(projectId);
        const result = await this.gitPullFromPreview(projectPath);
        return { success: true, ...result };
      } catch (error) {
        this.logger.error('Error in git:pull-from-preview handler:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * Push to branch
     */
    ipcMain.handle('git:push-to-branch', async (event, projectId, targetBranch) => {
      try {
        const projectPath = await this.getProjectPath(projectId);
        const result = await this.gitPushToBranch(projectPath, targetBranch);
        return { success: true, ...result };
      } catch (error) {
        this.logger.error('Error in git:push-to-branch handler:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * List remote branches
     */
    ipcMain.handle('git:list-remote-branches', async (event, projectId) => {
      try {
        const projectPath = await this.getProjectPath(projectId);
        const branches = await this.gitListRemoteBranches(projectPath);
        return { success: true, branches };
      } catch (error) {
        this.logger.error('Error in git:list-remote-branches handler:', error);
        return { success: false, error: error.message };
      }
    });

    this.logger.info('✅ Git operations IPC handlers registered');
  }

  /**
   * Unregister all Git operations IPC handlers
   */
  unregisterHandlers() {
    this.logger.info('🔧 Unregistering Git operations IPC handlers');
    
    ipcMain.removeHandler('git:list-branches');
    ipcMain.removeHandler('git:create-branch');
    ipcMain.removeHandler('git:checkout-branch');
    ipcMain.removeHandler('git:get-current-branch');
    ipcMain.removeHandler('git:get-repository-info');
    ipcMain.removeHandler('git:pull-from-preview');
    ipcMain.removeHandler('git:push-to-branch');
    ipcMain.removeHandler('git:list-remote-branches');
    
    this.logger.info('✅ Git operations IPC handlers unregistered');
  }
}

module.exports = { GitHandlers };