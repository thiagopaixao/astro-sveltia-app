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
const { GitOperations } = require('./gitOperations.js');

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
    this.gitOps = new GitOperations({ logger, databaseManager });
    this.gitOperationInProgress = false;
    this.LOCK_TIMEOUT_MS = 60000;
    this._lockTimeout = null;
    this._gitModuleCache = null;
  }

  async _getGit() {
    if (!this._gitModuleCache) {
      this._gitModuleCache = await import('isomorphic-git');
    }
    return this._gitModuleCache;
  }

  /**
   * Acquire the git operation lock
   * @returns {boolean} True if lock was acquired, false if already in progress
   */
  acquireGitLock() {
    if (this.gitOperationInProgress) {
      this.logger.warn('Git operation already in progress');
      return false;
    }
    this.gitOperationInProgress = true;
    this._lockTimeout = setTimeout(() => {
      this.logger.warn('Git operation lock auto-released after 60s timeout');
      this.gitOperationInProgress = false;
      this._lockTimeout = null;
    }, this.LOCK_TIMEOUT_MS);
    this.logger.info('Git operation lock acquired');
    return true;
  }

  /**
   * Release the git operation lock
   */
  releaseGitLock() {
    this.gitOperationInProgress = false;
    if (this._lockTimeout) {
      clearTimeout(this._lockTimeout);
      this._lockTimeout = null;
    }
    this.logger.info('Git operation lock released');
  }

  /**
   * Broadcast a message to all renderer windows
   * @param {string} channel - IPC channel name
   * @param {*} payload - Payload to send
   */
  broadcastToWindows(channel, payload) {
    try {
      const normalizedPayload = typeof payload === 'object' && payload !== null
        ? payload
        : { message: String(payload) };
      const { BrowserWindow } = require('electron');
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send(channel, normalizedPayload);
          }
        });
      }
    } catch (error) {
      this.logger.debug('broadcastToWindows failed (expected in tests):', error.message);
    }
  }

  /**
   * Send output to the commands console
   * @param {string} message - Message to send
   */
  sendOutput(message) {
    this.broadcastToWindows('command-output', { message });
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

        this.logger.info(`📂 Project data: ID=${row.id}, projectPath=${row.projectPath}, repoFolderName=${row.repoFolderName}`);

        // Validate required fields
        if (!row.projectPath) {
          reject(new Error(`Invalid project data: projectPath is missing`));
          return;
        }

        // Handle different path scenarios
        let projectPath;
        if (row.repoFolderName) {
          // Check if projectPath already includes repoFolderName
          if (row.projectPath.endsWith(row.repoFolderName)) {
            projectPath = row.projectPath;
            this.logger.info(`📂 Project path already includes repo folder: ${projectPath}`);
          } else {
            projectPath = path.join(row.projectPath, row.repoFolderName);
            this.logger.info(`📂 Constructed project path: ${projectPath}`);
          }
        } else {
          projectPath = row.projectPath;
          this.logger.info(`📂 Using project path directly: ${projectPath}`);
        }

        this.logger.info(`✅ Final project path: ${projectPath}`);
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
      this.logger.info(`🔍 Listing branches for repository: ${projectPath}`);
      
      // Check if directory exists and is a git repository
      const fs = require('fs');
      if (!fs.existsSync(projectPath)) {
        throw new Error(`Repository path does not exist: ${projectPath}`);
      }
      
      const gitDir = require('path').join(projectPath, '.git');
      if (!fs.existsSync(gitDir)) {
        throw new Error(`Not a git repository: ${projectPath}`);
      }
      
      // Get current branch with fallback
      let currentBranch = 'master'; // Default fallback
      try {
        currentBranch = await git.currentBranch({ fs, dir: projectPath });
        this.logger.info(`✅ Current branch detected: ${currentBranch}`);
      } catch (error) {
        this.logger.warn(`⚠️ Could not determine current branch, using fallback: ${error.message}`);
        // Try to get branches directly as fallback
        try {
          const refs = await git.listRefs({ fs, dir: projectPath });
          const headRef = refs.find(ref => ref === 'HEAD');
          if (headRef) {
            // Try to resolve HEAD manually
            const headFile = require('path').join(gitDir, 'HEAD');
            if (fs.existsSync(headFile)) {
              const headContent = fs.readFileSync(headFile, 'utf8');
              const match = headContent.match(/ref: refs\/heads\/(.+)/);
              if (match) {
                currentBranch = match[1].trim();
                this.logger.info(`✅ Current branch resolved from HEAD file: ${currentBranch}`);
              }
            }
          }
        } catch (fallbackError) {
          this.logger.warn(`⚠️ Could not resolve current branch from HEAD: ${fallbackError.message}`);
        }
      }
      
    // Use the simple and reliable git.listBranches() approach (same as working GitOperations.js)
    let branches = [];
    let remoteBranches = [];
    
    try {
      // Get all branches (local and remote) using isomorphic-git's built-in method
      const allBranches = await git.listBranches({ fs, dir: projectPath });
      
      // Separate local and remote branches (same logic as GitOperations.js)
      const localBranches = allBranches.filter(branch => !branch.includes('origin/'));
      const remoteBranchNames = allBranches.filter(branch => branch.includes('origin/'))
        .map(branch => branch.replace('origin/', ''));
      
      // Create branch objects for local branches
      for (const branchName of localBranches) {
        branches.push({
          name: branchName,
          isCurrent: branchName === currentBranch,
          isRemote: false
        });
      }
      
      // Create branch objects for remote branches
      for (const branchName of remoteBranchNames) {
        if (branchName !== 'HEAD') {
          remoteBranches.push({
            name: branchName,
            isCurrent: false,
            isRemote: true
          });
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to list branches via git.listBranches(): ${error.message}`);
      
      // Fallback to filesystem method if git.listBranches() fails
      this.logger.warn('Falling back to filesystem method...');
      try {
        const headsDir = require('path').join(gitDir, 'refs', 'heads');
        if (fs.existsSync(headsDir)) {
          const branchFiles = fs.readdirSync(headsDir);
          for (const branchName of branchFiles) {
            branches.push({
              name: branchName,
              isCurrent: branchName === currentBranch,
              isRemote: false
            });
          }
          this.logger.info(`Fallback: Found ${branchFiles.length} local branches via filesystem`);
        }
      } catch (fallbackError) {
        this.logger.error(`Filesystem fallback also failed: ${fallbackError.message}`);
      }
    }
      
      const result = {
        branches: branches.concat(remoteBranches),
        current: currentBranch
      };
      
      this.logger.info(`✅ Branch listing complete: ${result.branches.length} branches, current: ${result.current}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Error listing branches:', error);
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
      this.logger.info(`🔄 Checking out branch '${branchName}' in ${projectPath}`);
      
      const fs = require('fs');
      
      // First, try to checkout directly (for local branches)
      try {
        await git.checkout({
          fs,
          dir: projectPath,
          ref: branchName
        });
        
        this.logger.info(`✅ Successfully checked out branch: ${branchName}`);
        return;
      } catch (directError) {
        this.logger.warn(`⚠️ Direct checkout failed: ${directError.message}`);
        
        // If direct checkout fails, try to list branches and check if it exists
        try {
          const branchResult = await this.gitListBranches(projectPath);
          const localBranch = branchResult.branches.find(b => b.name === branchName && !b.isRemote);
          const remoteBranch = branchResult.branches.find(b => b.name === branchName && b.isRemote);
          
          if (localBranch) {
            // Local branch exists but checkout failed, try again with force
            this.logger.info(`📂 Local branch exists, trying checkout again...`);
            await git.checkout({
              fs,
              dir: projectPath,
              ref: branchName
            });
            this.logger.info(`✅ Successfully checked out local branch: ${branchName}`);
          } else if (remoteBranch) {
            // Remote branch exists, create local tracking branch
            this.logger.info(`📥 Remote branch exists, creating local tracking branch...`);
            await git.branch({
              fs,
              dir: projectPath,
              ref: branchName,
              checkout: true
            });
            this.logger.info(`✅ Created and checked out local branch: ${branchName}`);
          } else {
            throw new Error(`Branch '${branchName}' not found locally or remotely`);
          }
        } catch (branchError) {
          this.logger.error(`❌ Branch checkout failed: ${branchError.message}`);
          throw branchError;
        }
      }
    } catch (error) {
      this.logger.error('❌ Error checking out branch:', error);
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
      this.logger.info(`📋 Getting repository information from ${projectPath}`);
      
      const fs = require('fs');
      
      // Get current branch with fallback
      let currentBranch = 'master';
      try {
        currentBranch = await git.currentBranch({ fs, dir: projectPath });
        this.logger.info(`✅ Current branch: ${currentBranch}`);
      } catch (error) {
        this.logger.warn(`⚠️ Could not get current branch: ${error.message}`);
        // Use gitListBranches to get current branch
        try {
          const branchResult = await this.gitListBranches(projectPath);
          currentBranch = branchResult.current || 'master';
          this.logger.info(`✅ Using fallback current branch: ${currentBranch}`);
        } catch (fallbackError) {
          this.logger.warn(`⚠️ Could not get branches for fallback: ${fallbackError.message}`);
        }
      }
      
      // Get branches
      const branchResult = await this.gitListBranches(projectPath);
      const allBranches = branchResult.branches || [];
      const localBranches = allBranches.filter(b => !b.isRemote);
      const remoteBranches = allBranches.filter(b => b.isRemote);
      
      // Get remote URL
      let remoteUrl = null;
      try {
        remoteUrl = await git.getConfig({
          fs,
          dir: projectPath,
          path: 'remote.origin.url'
        });
      } catch (error) {
        this.logger.debug('Could not get remote URL:', error.message);
      }
      
      // Get last commit information
      let lastCommit = {
        hash: '',
        message: '',
        date: null
      };
      
      try {
        // Try to get commit OID for the current branch HEAD
        const commitOid = await git.resolveRef({
          fs,
          dir: projectPath,
          ref: currentBranch
        });
        
        if (commitOid) {
          // Get commit details
          const commit = await git.readCommit({
            fs,
            dir: projectPath,
            oid: commitOid
          });
          
          if (commit && commit.commit) {
            lastCommit.hash = commitOid.substring(0, 7); // Short hash (7 characters)
            lastCommit.message = commit.commit.message.split('\n')[0]; // First line only
            lastCommit.date = new Date(commit.commit.author.timestamp * 1000);
          }
        }
      } catch (error) {
        this.logger.warn('Could not get last commit info:', error.message);
        // Try fallback to get commit from HEAD directly
        try {
          const headOid = await git.resolveRef({
            fs,
            dir: projectPath,
            ref: 'HEAD'
          });
          
          if (headOid) {
            const commit = await git.readCommit({
              fs,
              dir: projectPath,
              oid: headOid
            });
            
            if (commit && commit.commit) {
              lastCommit.hash = headOid.substring(0, 7);
              lastCommit.message = commit.commit.message.split('\n')[0];
              lastCommit.date = new Date(commit.commit.author.timestamp * 1000);
              this.logger.info(`✅ Got commit info from HEAD: ${lastCommit.hash}`);
            }
          }
        } catch (headError) {
          this.logger.warn('Could not get commit from HEAD either:', headError.message);
        }
      }
      
      // Get status
      let isClean = true;
      let status = null;
      try {
        const statusResult = await git.statusMatrix({
          fs,
          dir: projectPath
        });
        
        // Check if there are any unstaged changes
        isClean = statusResult.every(row => row[1] === row[2]);
        status = isClean ? 'clean' : 'dirty';
      } catch (error) {
        this.logger.debug('Could not get status:', error.message);
      }
      
      const result = {
        workingDirectory: projectPath,
        remoteUrl: remoteUrl || '',
        lastCommit: lastCommit,
        currentBranch,
        branches: localBranches.map(b => b.name),
        remoteBranches: remoteBranches.map(b => b.name),
        isClean,
        status
      };
      
      this.logger.info(`✅ Repository info retrieved:`, result);
      return result;
    } catch (error) {
      this.logger.error('Error getting repository info:', error);
      throw error;
    }
  }

  /**
   * Pull changes from remote for current branch
   * @param {string} projectPath - Path to the git repository
   * @returns {Promise<{success: boolean, pulled?: boolean, branch?: string, error?: string}>}
   */
  async gitPullFromPreview(projectPath) {
    if (!this.acquireGitLock()) {
      this.sendOutput('⚠️ Operação Git já em andamento. Aguarde...');
      return { success: false, error: 'Git operation already in progress. Please wait.' };
    }

    const fs = require('fs');

    try {
      const token = await this.gitOps.getGitHubToken();
      if (!token) {
        this.sendOutput('❌ Autenticação GitHub necessária. Faça login novamente.');
        return { success: false, error: 'Autenticação GitHub necessária. Faça login novamente.' };
      }

      const gitMod = await this._getGit();

      const currentBranch = await gitMod.currentBranch({ fs, dir: projectPath });
      if (!currentBranch) {
        this.sendOutput('❌ Nenhuma branch selecionada (detached HEAD). Selecione uma branch para atualizar.');
        return { success: false, error: 'Nenhuma branch selecionada (detached HEAD). Selecione uma branch primeiro.' };
      }

      const auth = { username: token, password: 'x-oauth-basic' };

      this.sendOutput(`📥 Buscando alterações da branch remota '${currentBranch}'...`);

      await gitMod.fetch({
        fs,
        http,
        dir: projectPath,
        remote: 'origin',
        ref: currentBranch,
        singleBranch: true,
        onAuth: () => auth,
      });

      this.sendOutput('🔄 Mesclando alterações...');

      await gitMod.pull({
        fs,
        http,
        dir: projectPath,
        ref: currentBranch,
        singleBranch: true,
        author: { name: 'documental', email: 'documental@app' },
        onAuth: () => auth,
      });

      this.sendOutput(`✅ Pull concluído com sucesso na branch: ${currentBranch}`);
      this.logger.info(`Successfully pulled from branch: ${currentBranch}`);
      return { success: true, pulled: true, branch: currentBranch };

    } catch (error) {
      this.logger.error('Error pulling from branch:', error);

      let errorMessage = error.message || 'Erro desconhecido ao atualizar';

      if (error.message && (error.message.includes('merge') || error.message.includes('conflict'))) {
        errorMessage = 'Conflito de merge detectado. Resolva manualmente.';
      } else if (error.message && (error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'))) {
        errorMessage = 'Erro de rede. Verifique sua conexão.';
      } else if (error.message && (error.message.includes('401') || error.message.includes('403') || error.message.includes('authentication'))) {
        errorMessage = 'Erro de autenticação. Faça login novamente.';
      }

      this.sendOutput(`❌ Erro ao atualizar: ${errorMessage}`);
      return { success: false, error: errorMessage };

    } finally {
      this.releaseGitLock();
    }
  }

  /**
   * Push changes to a specific branch
   * @param {string} projectPath - Path to the git repository
   * @param {string} targetBranch - Target branch name
   * @returns {Promise<{success: boolean, pushed?: boolean, branch?: string, error?: string}>}
   */
  async gitPushToBranch(projectPath, targetBranch) {
    // Acquire lock
    if (!this.acquireGitLock()) {
      this.sendOutput('⚠️ Operação Git já em andamento. Aguarde...');
      return { success: false, error: 'Git operation already in progress. Please wait.' };
    }

    const fs = require('fs');

    try {
      // Get auth token
      const token = await this.gitOps.getGitHubToken();
      if (!token) {
        this.sendOutput('❌ Autenticação GitHub necessária. Faça login novamente.');
        return { success: false, error: 'Autenticação GitHub necessária. Faça login novamente.' };
      }

      // Configure git user (best-effort)
      this.sendOutput('⚙️ Configurando usuário git...');
      const userConfigured = await this.gitOps.configureGitForUser(projectPath);
      if (!userConfigured) {
        this.sendOutput('⚠️ Não foi possível configurar usuário git. Continuando com configuração existente...');
        this.logger.warn('Could not configure git user, proceeding with existing config');
      }

      const auth = { username: token, password: 'x-oauth-basic' };

      const gitMod = await this._getGit();

      this.sendOutput(`🚀 Publicando alterações na branch: ${targetBranch}...`);

      await gitMod.push({
        fs,
        http,
        dir: projectPath,
        remote: 'origin',
        ref: targetBranch,
        onAuth: () => auth,
      });

      this.sendOutput(`✅ Push concluído com sucesso na branch: ${targetBranch}`);
      this.logger.info(`Successfully pushed to branch: ${targetBranch}`);
      return { success: true, pushed: true, branch: targetBranch };

    } catch (error) {
      this.logger.error('Error pushing to branch:', error);

      let errorMessage = error.message || 'Erro desconhecido ao publicar';

      if (error.message && error.message.includes('non-fast-forward')) {
        errorMessage = 'Push rejeitado. Faça pull antes de publicar (non-fast-forward).';
      } else if (error.message && (error.message.includes('401') || error.message.includes('403') || error.message.includes('authentication'))) {
        errorMessage = 'Erro de autenticação. Faça login novamente.';
      } else if (error.message && (error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'))) {
        errorMessage = 'Erro de rede. Verifique sua conexão.';
      }

      this.sendOutput(`❌ Erro ao publicar: ${errorMessage}`);
      return { success: false, error: errorMessage };

    } finally {
      this.releaseGitLock();
    }
  }

  /**
   * List remote branches
   * @param {string} projectPath - Path to the git repository
   * @returns {Promise<Array<string>>} List of remote branch names
   */
  async gitListRemoteBranches(projectPath) {
    try {
      this.sendOutput('🔍 Buscando branches remotas...');

      // Get auth token for private repo support
      const token = await this.gitOps.getGitHubToken();
      const auth = token ? { username: token, password: 'x-oauth-basic' } : undefined;

      const gitMod = await this._getGit();

      const url = await gitMod.getConfig({
        fs: require('fs'),
        dir: projectPath,
        path: 'remote.origin.url'
      });

      const listServerRefsConfig = {
        http,
        url,
      };

      if (auth) {
        listServerRefsConfig.onAuth = () => auth;
      }

      const refs = await gitMod.listServerRefs(listServerRefsConfig);

      const branches = refs
        .filter(ref => ref.ref.startsWith('refs/heads/'))
        .map(ref => ref.ref.replace('refs/heads/', ''))
        .filter(name => name !== 'HEAD');

      return branches;
    } catch (error) {
      this.logger.error('Error listing remote branches:', error);
      if (!error.message?.includes('auth') && !(await this.gitOps.getGitHubToken())) {
        throw new Error('Autenticação necessária para repositórios privados');
      }
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
        return { success: true, branches: result.branches, currentBranch: result.current };
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
        return result;
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
        return result;
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