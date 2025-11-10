/**
 * @fileoverview IPC handlers for GitHub authentication and user management
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { ipcMain } = require('electron');
const keytar = require('keytar');
const GITHUB_CONFIG = require('../../github-config');

/**
 * @typedef {Object} AuthResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {Object} [userInfo] - GitHub user information
 * @property {string} [error] - Error message if operation failed
 */

/**
 * @typedef {Object} AuthStatus
 * @property {boolean} authenticated - Whether user is authenticated
 * @property {Object} [userInfo] - User information if authenticated
 * @property {string} [error] - Error message if not authenticated
 */

/**
 * Authentication IPC Handlers
 */
class AuthHandlers {
  /**
   * Create an instance of AuthHandlers
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.databaseManager - Database manager instance
   */
  constructor({ logger, databaseManager }) {
    this.logger = logger;
    this.databaseManager = databaseManager;
  }

  /**
   * Get GitHub token from keytar
   * @returns {Promise<string|null>} GitHub token or null if not found
   */
  async getGitHubToken() {
    try {
      const token = await keytar.getPassword(GITHUB_CONFIG.SERVICE_NAME, 'github-token');
      return token;
    } catch (error) {
      this.logger.error('Error getting GitHub token:', error);
      return null;
    }
  }

  /**
   * Get GitHub user information using token
   * @param {string} token - GitHub token
   * @returns {Promise<Object|null>} User information or null if error
   */
  async getGitHubUserInfo(token) {
    try {
      // Dynamic import to handle ESM module
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.users.getAuthenticated();
      return data;
    } catch (error) {
      this.logger.error('Error getting GitHub user info:', error);
      return null;
    }
  }

  /**
   * Authenticate with GitHub using device flow
   * @returns {Promise<AuthResult>} Authentication result
   */
  async authenticateWithGitHub() {
    try {
      this.logger.info('🔐 Starting GitHub authentication flow...');
      
      // For now, return a placeholder implementation
      // In a real implementation, this would use GitHub OAuth device flow
      throw new Error('GitHub authentication flow not implemented yet');
      
    } catch (error) {
      this.logger.error('❌ GitHub authentication failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save user information to database
   * @param {Object} userInfo - GitHub user information
   * @returns {Promise<boolean>} Success status
   */
  async saveUserInfo(userInfo) {
    try {
      const db = await this.databaseManager.getDatabase();
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO users (githubId, login, name, email, avatarUrl, updatedAt) 
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [userInfo.id, userInfo.login, userInfo.name, userInfo.email, userInfo.avatar_url],
          (err) => {
            if (err) {
              this.logger.error('Error saving user info:', err.message);
              reject(err);
            } else {
              this.logger.info('✅ User info saved to database');
              resolve();
            }
          }
        );
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error saving user info:', error);
      return false;
    }
  }

  /**
   * Register all authentication IPC handlers
   */
  registerHandlers() {
    this.logger.info('🔐 Registering authentication IPC handlers');

    /**
     * Check GitHub authentication status
     */
    ipcMain.handle('checkGitHubAuth', async () => {
      try {
        const token = await this.getGitHubToken();
        if (!token) {
          return { authenticated: false };
        }

        const userInfo = await this.getGitHubUserInfo(token);
        if (userInfo) {
          return { authenticated: true, userInfo };
        } else {
          return { authenticated: false };
        }
      } catch (error) {
        this.logger.error('Error checking GitHub auth:', error);
        return { authenticated: false, error: error.message };
      }
    });

    /**
     * Authenticate with GitHub
     */
    ipcMain.handle('authenticateWithGitHub', async () => {
      try {
        const result = await this.authenticateWithGitHub();
        
        if (result.success && result.userInfo) {
          // Save user info to database
          const saved = await this.saveUserInfo(result.userInfo);
          if (!saved) {
            return { success: false, error: 'Failed to save user information' };
          }
        }
        
        return result;
      } catch (error) {
        this.logger.error('Error in GitHub authentication:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * Complete welcome setup
     */
    ipcMain.handle('completeWelcomeSetup', async () => {
      try {
        // This would mark setup as completed in preferences
        this.logger.info('✅ Welcome setup completed');
        return { success: true };
      } catch (error) {
        this.logger.error('Error completing welcome setup:', error);
        return { success: false, error: error.message };
      }
    });

    this.logger.info('✅ Authentication IPC handlers registered');
  }

  /**
   * Unregister all authentication IPC handlers
   */
  unregisterHandlers() {
    this.logger.info('🔐 Unregistering authentication IPC handlers');
    
    ipcMain.removeHandler('checkGitHubAuth');
    ipcMain.removeHandler('authenticateWithGitHub');
    ipcMain.removeHandler('completeWelcomeSetup');
    
    this.logger.info('✅ Authentication IPC handlers unregistered');
  }
}

module.exports = { AuthHandlers };