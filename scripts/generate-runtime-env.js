'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname, '..');

/**
 * Load environment variables from a file if it exists.
 * @param {string} envPath - Absolute path to env file
 * @param {boolean} [override=false] - Whether to override existing values
 */
function loadEnvFile(envPath, override = false) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const result = dotenv.config({ path: envPath, override });
  if (result.error) {
    console.warn(`⚠️  Failed to load env file at ${envPath}:`, result.error.message);
  } else {
    console.log(`ℹ️  Loaded environment variables from ${envPath}`);
  }
}

function main() {
  console.log('🔧 Generating runtime environment configuration...');

  // Load default env files (development)
  loadEnvFile(path.join(projectRoot, '.env'));
  loadEnvFile(path.join(projectRoot, '.env.local'));

  // Load electron-builder env (overrides)
  loadEnvFile(path.join(projectRoot, 'electron-builder.env'), true);

  const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
  if (!clientId) {
    console.error('❌ GITHUB_CLIENT_ID is not defined.');
    console.error('   Please set GITHUB_CLIENT_ID in your environment or electron-builder.env before building.');
    process.exit(1);
  }

  const outputDir = path.join(projectRoot, 'resources', 'config');
  fs.mkdirSync(outputDir, { recursive: true });

  const runtimeConfig = {
    generatedAt: new Date().toISOString(),
    GITHUB_CLIENT_ID: clientId
  };

  const outputPath = path.join(outputDir, 'runtime-env.json');
  fs.writeFileSync(outputPath, JSON.stringify(runtimeConfig, null, 2), 'utf8');
  console.log(`✅ Runtime environment file created at ${outputPath}`);
}

main();
