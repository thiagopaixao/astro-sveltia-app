#!/usr/bin/env node

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';

/**
 * Recursively find all JS files in directory
 * @param {string} dir - Directory to search
 * @param {string[]} files - Array to store file paths
 * @returns {string[]} - Array of file paths
 */
function getAllJsFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllJsFiles(fullPath, files);
    } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Check if file follows hybrid CJS/ESM pattern
 * @param {string} filePath - Path to file
 * @returns {Object} - Hybrid validation result
 */
function validateHybridPattern(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const ext = extname(filePath);
    
    const issues = [];
    
    // Check file extension consistency
    if (ext === '.mjs') {
      // Should use ESM imports/exports
      if (content.includes('require(') || content.includes('module.exports')) {
        issues.push('ESM file (.mjs) should use import/export syntax');
      }
    } else if (ext === '.js') {
      // For src/ directory, .js files should use CJS (based on project pattern)
      if (content.includes('import ') && !content.includes('require(')) {
        issues.push('CJS file (.js) should use require/module.exports syntax');
      }
    }
    
    // Check for mixed patterns in same file
    const hasRequire = content.includes('require(');
    const hasImport = content.includes('import ');
    const hasModuleExports = content.includes('module.exports');
    const hasExport = content.includes('export ');
    
    if (hasRequire && hasImport) {
      issues.push('File mixes require() and import statements');
    }
    
    if (hasModuleExports && hasExport) {
      issues.push('File mixes module.exports and export statements');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  } catch (error) {
    return {
      isValid: false,
      issues: [`Error reading file: ${error.message}`]
    };
  }
}

/**
 * Validate hybrid CJS/ESM pattern
 */
function validateHybrid() {
  console.log('🔍 Validating hybrid CJS/ESM pattern...');
  
  try {
    const jsFiles = getAllJsFiles(SRC_DIR);
    const filesWithIssues = [];
    
    for (const file of jsFiles) {
      const result = validateHybridPattern(file);
      if (!result.isValid) {
        filesWithIssues.push({
          file,
          issues: result.issues
        });
      }
    }
    
    if (filesWithIssues.length === 0) {
      console.log('✅ All files follow hybrid CJS/ESM pattern correctly');
      console.log(`📊 Checked ${jsFiles.length} files`);
      return true;
    } else {
      console.log(`❌ ${filesWithIssues.length} files have hybrid pattern issues:`);
      
      filesWithIssues.forEach(({ file, issues }) => {
        console.log(`\n📄 ${file}:`);
        issues.forEach(issue => {
          console.log(`  - ${issue}`);
        });
      });
      
      return false;
    }
  } catch (error) {
    console.error('❌ Error validating hybrid pattern:', error.message);
    return false;
  }
}

// Run validation
const success = validateHybrid();
process.exit(success ? 0 : 1);