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
      this.logger.info('📋 GitHub Config:', {
        clientId: GITHUB_CONFIG.CLIENT_ID,
        deviceCodeUrl: GITHUB_CONFIG.DEVICE_CODE_URL,
        tokenUrl: GITHUB_CONFIG.TOKEN_URL,
        scopes: GITHUB_CONFIG.SCOPES
      });
      
      // Step 1: Initiate device flow
      this.logger.info('📡 Initiating device flow...');
      const deviceCodeResponse = await this.initiateDeviceFlow();
      
      this.logger.info('✅ Device flow initiated successfully:', {
        deviceCode: deviceCodeResponse.user_code,
        verificationUri: deviceCodeResponse.verification_uri,
        expiresIn: deviceCodeResponse.expires_in,
        interval: deviceCodeResponse.interval
      });
      
      // Step 2: Return device code info to frontend for display
      return {
        success: false,
        requiresDeviceCode: true,
        deviceCode: deviceCodeResponse.user_code,
        verificationUri: deviceCodeResponse.verification_uri,
        expiresIn: deviceCodeResponse.expires_in,
        interval: deviceCodeResponse.interval,
        deviceCodeInternal: deviceCodeResponse.device_code
      };
      
    } catch (error) {
      this.logger.error('❌ GitHub authentication failed:', error);
      this.logger.error('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Continue GitHub authentication after showing device code
   * @param {string} deviceCode - Internal device code
   * @param {number} interval - Polling interval
   * @returns {Promise<AuthResult>} Authentication result
   */
  async continueGitHubAuthentication(deviceCode, interval) {
    try {
      this.logger.info('🔄 Continuing GitHub authentication polling...');
      this.logger.info('📋 Polling parameters:', {
        deviceCode: deviceCode,
        interval: interval
      });
      
      // Step 3: Poll for token
      this.logger.info('⏳ Starting token polling...');
      const token = await this.pollForToken(deviceCode, interval);
      
      if (!token) {
        throw new Error('Failed to obtain access token - token is null');
      }
      
      this.logger.info('🔑 Access token obtained successfully');
      
      // Step 4: Store token securely
      this.logger.info('💾 Storing token securely...');
      await keytar.setPassword(GITHUB_CONFIG.SERVICE_NAME, 'github-token', token);
      this.logger.info('✅ Token stored successfully');
      
      // Step 5: Get user information
      this.logger.info('👤 Getting user information...');
      const userInfo = await this.getGitHubUserInfo(token);
      
      if (!userInfo) {
        throw new Error('Failed to get user information - userInfo is null');
      }
      
      this.logger.info(`✅ Successfully authenticated as ${userInfo.login}`, {
        id: userInfo.id,
        login: userInfo.login,
        name: userInfo.name,
        email: userInfo.email
      });
      
      return { 
        success: true, 
        userInfo: {
          id: userInfo.id,
          login: userInfo.login,
          name: userInfo.name,
          email: userInfo.email,
          avatar_url: userInfo.avatar_url
        }
      };
      
    } catch (error) {
      this.logger.error('❌ GitHub authentication continuation failed:', error);
      this.logger.error('🔍 Continuation error details:', {
        message: error.message,
        stack: error.stack,
        deviceCode: deviceCode,
        interval: interval
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Initiate GitHub device flow
   * @returns {Promise<Object>} Device code response
   */
  async initiateDeviceFlow() {
    try {
      this.logger.info('🔧 Building device flow request...');
      
      const params = new URLSearchParams({
        client_id: GITHUB_CONFIG.CLIENT_ID,
        scope: GITHUB_CONFIG.SCOPES.join(' ')
      });

      this.logger.info('📤 Sending request to GitHub device code API:', {
        url: GITHUB_CONFIG.DEVICE_CODE_URL,
        method: 'POST',
        clientId: GITHUB_CONFIG.CLIENT_ID,
        scopes: GITHUB_CONFIG.SCOPES.join(' '),
        params: params.toString()
      });

      const response = await fetch(GITHUB_CONFIG.DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      this.logger.info('📥 GitHub device code API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('❌ Device flow request failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to initiate device flow: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      this.logger.info('✅ Device flow response received:', responseData);
      return responseData;
      
    } catch (error) {
      this.logger.error('💥 Error in initiateDeviceFlow:', error);
      throw error;
    }
  }

  /**
   * Poll GitHub for access token
   * @param {string} deviceCode - Device code from GitHub
   * @param {number} interval - Polling interval in seconds
   * @returns {Promise<string|null>} Access token or null if failed
   */
  async pollForToken(deviceCode, interval) {
    const maxAttempts = 30; // Maximum 5 minutes (30 * 10 seconds)
    let attempts = 0;

    this.logger.info('⏱️ Starting token polling with parameters:', {
      deviceCode: deviceCode,
      interval: interval,
      maxAttempts: maxAttempts,
      tokenUrl: GITHUB_CONFIG.TOKEN_URL
    });

    while (attempts < maxAttempts) {
      attempts++;
      this.logger.info(`🔄 Polling attempt ${attempts}/${maxAttempts}...`);
      
      await new Promise(resolve => setTimeout(resolve, interval * 1000));

      const params = new URLSearchParams({
        client_id: GITHUB_CONFIG.CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      });

      try {
        this.logger.info('📤 Sending token request to GitHub:', {
          url: GITHUB_CONFIG.TOKEN_URL,
          method: 'POST',
          clientId: GITHUB_CONFIG.CLIENT_ID,
          deviceCode: deviceCode,
          params: params.toString()
        });

        const response = await fetch(GITHUB_CONFIG.TOKEN_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        });

        this.logger.info('📥 Token API response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error('❌ Token request failed:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: 'unknown', error_description: errorText };
          }
          
          if (errorData.error === 'authorization_pending') {
            this.logger.info('⏳ Authorization still pending, continuing polling...');
            continue;
          } else if (errorData.error === 'slow_down') {
            this.logger.info('🐌 GitHub requested slower polling, waiting longer...');
            // Wait longer before next poll
            await new Promise(resolve => setTimeout(resolve, interval * 2000));
            continue;
          } else {
            throw new Error(`Token request failed: ${errorData.error_description || errorData.error}`);
          }
        }

        const tokenData = await response.json();
        this.logger.info('✅ Token received successfully!', {
          hasAccessToken: !!tokenData.access_token,
          tokenType: tokenData.token_type,
          scope: tokenData.scope
        });
        return tokenData.access_token;

      } catch (error) {
        this.logger.error(`💥 Error in polling attempt ${attempts}:`, error);
        this.logger.error('🔍 Polling error details:', {
          message: error.message,
          stack: error.stack,
          attempts: attempts,
          maxAttempts: maxAttempts
        });
        
        if (attempts >= maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error(`Authentication timed out after ${maxAttempts} attempts. Please try again.`);
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
     * Continue GitHub authentication after device code display
     */
    ipcMain.handle('continueGitHubAuth', async (event, deviceCode, interval) => {
      try {
        const result = await this.continueGitHubAuthentication(deviceCode, interval);
        
        if (result.success && result.userInfo) {
          // Save user info to database
          const saved = await this.saveUserInfo(result.userInfo);
          if (!saved) {
            return { success: false, error: 'Failed to save user information' };
          }
        }
        
        return result;
      } catch (error) {
        this.logger.error('Error continuing GitHub authentication:', error);
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
      ipcMain.removeHandler('continueGitHubAuth');
      
      this.logger.info('✅ Authentication IPC handlers unregistered');
    }
}

module.exports = { AuthHandlers };