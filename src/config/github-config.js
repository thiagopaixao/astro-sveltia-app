/**
 * @fileoverview GitHub Device Flow Configuration
 * @author Documental Team
 * @since 1.0.0
 * 
 * IMPORTANT: You need to create a GitHub OAuth App for this to work
 * Go to: https://github.com/settings/applications/new
 * Application name: Documental App
 * Homepage URL: http://localhost:3000
 * Authorization callback URL: (not needed for Device Flow)
 * 
 * Note: Device Flow is more secure as it doesn't require Client Secret
 */

'use strict';

/**
 * @typedef {Object} GitHubConfig
 * @property {string} CLIENT_ID - GitHub OAuth App Client ID
 * @property {string[]} SCOPES - OAuth permissions requested
 * @property {string} DEVICE_CODE_URL - Device flow endpoint for device code
 * @property {string} TOKEN_URL - OAuth token exchange endpoint
 * @property {string} VERIFICATION_URI - User verification URL
 * @property {string} SERVICE_NAME - Service name for secure token storage
 */

/**
 * Development Client ID (for testing only)
 * In production, always use environment variable GITHUB_CLIENT_ID
 */
const DEV_CLIENT_ID = 'Iv23liAqK8cX9v2l1p';

/**
 * GitHub Device Flow Configuration
 * @type {GitHubConfig}
 */
const GITHUB_CONFIG = {
  // Client ID from GitHub OAuth App (only Client ID is needed for Device Flow)
  // Using environment variable in production, fallback to development ID
  CLIENT_ID: process.env.GITHUB_CLIENT_ID || DEV_CLIENT_ID,
  
  // OAuth scopes (permissions requested)
  SCOPES: ['user:email', 'repo'],
  
  // Device Flow endpoints
  DEVICE_CODE_URL: 'https://github.com/login/device/code',
  TOKEN_URL: 'https://github.com/login/oauth/access_token',
  VERIFICATION_URI: 'https://github.com/login/device',
  
  // Service name for keytar (secure token storage)
  SERVICE_NAME: 'documental-app'
};

/**
 * Validate GitHub configuration
 * @returns {Object} Validation result
 * @returns {boolean} result.isValid - Whether configuration is valid
 * @returns {string[]} result.warnings - Array of warning messages
 * @returns {string[]} result.errors - Array of error messages
 */
function validateGitHubConfig() {
  const warnings = [];
  const errors = [];
  
  // Check if using development Client ID
  if (!process.env.GITHUB_CLIENT_ID && GITHUB_CONFIG.CLIENT_ID === DEV_CLIENT_ID) {
    warnings.push('⚠️ Using development GitHub Client ID. Set GITHUB_CLIENT_ID environment variable for production.');
  }
  
  // Validate Client ID format
  if (!GITHUB_CONFIG.CLIENT_ID || typeof GITHUB_CONFIG.CLIENT_ID !== 'string') {
    errors.push('❌ GitHub Client ID is required and must be a string');
  } else if (GITHUB_CONFIG.CLIENT_ID.length < 10) {
    errors.push('❌ GitHub Client ID appears to be invalid (too short)');
  }
  
  // Validate scopes
  if (!Array.isArray(GITHUB_CONFIG.SCOPES) || GITHUB_CONFIG.SCOPES.length === 0) {
    errors.push('❌ GitHub SCOPES must be a non-empty array');
  }
  
  // Validate URLs
  const requiredUrls = ['DEVICE_CODE_URL', 'TOKEN_URL', 'VERIFICATION_URI'];
  requiredUrls.forEach(urlKey => {
    const url = GITHUB_CONFIG[urlKey];
    if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
      errors.push(`❌ ${urlKey} must be a valid HTTPS URL`);
    }
  });
  
  // Validate service name
  if (!GITHUB_CONFIG.SERVICE_NAME || typeof GITHUB_CONFIG.SERVICE_NAME !== 'string') {
    errors.push('❌ SERVICE_NAME is required and must be a string');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Get configuration with validation
 * @returns {GitHubConfig} Validated GitHub configuration
 * @throws {Error} If configuration is invalid
 */
function getValidatedConfig() {
  const validation = validateGitHubConfig();
  
  // Log warnings
  if (validation.warnings.length > 0) {
    console.log('GitHub Configuration Warnings:');
    validation.warnings.forEach(warning => console.log(`  ${warning}`));
  }
  
  // Throw error if invalid
  if (!validation.isValid) {
    const errorMessage = 'GitHub Configuration Error:\n' + 
      validation.errors.map(error => `  ${error}`).join('\n');
    throw new Error(errorMessage);
  }
  
  return GITHUB_CONFIG;
}

// Validate configuration on module load
try {
  getValidatedConfig();
} catch (error) {
  console.error('❌ GitHub configuration validation failed:', error.message);
  // In development, continue with warnings; in production, this should be fatal
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

module.exports = {
  GITHUB_CONFIG,
  validateGitHubConfig,
  getValidatedConfig
};