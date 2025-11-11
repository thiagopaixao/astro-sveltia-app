#!/usr/bin/env node

import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';

/**
 * Check if file has valid extension
 * @param {string} filePath - Path to file
 * @returns {boolean} - True if extension is valid
 */
function hasValidExtension(filePath) {
  const ext = extname(filePath);
  const ALLOWED_EXTENSIONS = ['.js', '.cjs', '.mjs', '.json'];
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Recursively find all files in directory
 * @param {string} dir - Directory to search
 * @param {string[]} files - Array to store file paths
 * @returns {string[]} - Array of file paths
 */
function getAllFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Validate file extensions in src directory
 */
function validateExtensions() {
  console.log('🔍 Validating file extensions...');
  
  try {
    const allFiles = getAllFiles(SRC_DIR);
    const invalidFiles = [];
    
    for (const file of allFiles) {
      if (!hasValidExtension(file)) {
        invalidFiles.push(file);
      }
    }
    
    if (invalidFiles.length === 0) {
      console.log('✅ All files have valid extensions');
      console.log(`📊 Checked ${allFiles.length} files`);
      return true;
    } else {
      console.log('❌ Files with invalid extensions found:');
      invalidFiles.forEach(file => {
        console.log(`  - ${file}`);
      });
      console.log(`\n📋 Allowed extensions: .js, .cjs, .mjs, .json`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error validating extensions:', error.message);
    return false;
  }
}

// Run validation
const success = validateExtensions();
process.exit(success ? 0 : 1);