// GitHub Device Flow Configuration
// IMPORTANT: You need to create a GitHub OAuth App for this to work
// Go to: https://github.com/settings/applications/new
// Application name: Documental App
// Homepage URL: http://localhost:3000
// Authorization callback URL: (not needed for Device Flow)

const GITHUB_CONFIG = {
  // Client ID from GitHub OAuth App (only Client ID is needed for Device Flow)
  CLIENT_ID: process.env.GITHUB_CLIENT_ID || 'Iv1.a1b2c3d4e5f6g7h8',
  
  // OAuth scopes (permissions requested)
  SCOPES: ['user:email', 'repo'],
  
  // Device Flow endpoints
  DEVICE_CODE_URL: 'https://github.com/login/device/code',
  TOKEN_URL: 'https://github.com/login/oauth/access_token',
  VERIFICATION_URI: 'https://github.com/login/device',
  
  // Service name for keytar (secure token storage)
  SERVICE_NAME: 'documental-app'
};

module.exports = GITHUB_CONFIG;