#!/usr/bin/env node

import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

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
 * Check if file has JSDoc comments for public APIs
 * @param {string} filePath - Path to file
 * @returns {Object} - JSDoc validation result
 */
function validateJSDoc(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let hasJSDoc = false;
    let missingDocs = [];
    
    // Simple heuristic: check for function/class declarations and preceding JSDoc
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for function declarations
      if (line.match(/^(async\s+)?function\s+\w+|^\s*\w+\s*:\s*function|^class\s+\w+/)) {
        // Check if previous lines have JSDoc
        let hasDoc = false;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          const prevLine = lines[j].trim();
          if (prevLine.startsWith('/**')) {
            hasDoc = true;
            hasJSDoc = true;
            break;
          }
          if (prevLine && !prevLine.startsWith('*') && !prevLine.startsWith('/')) {
            break;
          }
        }
        
        if (!hasDoc) {
          missingDocs.push(`Line ${i + 1}: ${line.substring(0, 50)}...`);
        }
      }
    }
    
    return {
      hasJSDoc,
      missingDocs,
      total: missingDocs.length === 0
    };
  } catch (error) {
    return {
      hasJSDoc: false,
      missingDocs: [`Error reading file: ${error.message}`],
      total: false
    };
  }
}

/**
 * Validate JSDoc coverage
 */
function validateJSDocCoverage() {
  console.log('🔍 Validating JSDoc coverage...');
  
  try {
    const jsFiles = getAllJsFiles(SRC_DIR);
    const filesWithIssues = [];
    let totalMissingDocs = 0;
    
    for (const file of jsFiles) {
      const result = validateJSDoc(file);
      if (!result.total) {
        filesWithIssues.push({
          file,
          missingDocs: result.missingDocs
        });
        totalMissingDocs += result.missingDocs.length;
      }
    }
    
    if (filesWithIssues.length === 0) {
      console.log('✅ All files have adequate JSDoc coverage');
      console.log(`📊 Checked ${jsFiles.length} files`);
      return true;
    } else {
      console.log(`❌ ${filesWithIssues.length} files have JSDoc issues:`);
      console.log(`📊 Total missing documentation: ${totalMissingDocs} items\n`);
      
      filesWithIssues.forEach(({ file, missingDocs }) => {
        console.log(`📄 ${file}:`);
        missingDocs.forEach(doc => {
          console.log(`  - ${doc}`);
        });
        console.log('');
      });
      
      return false;
    }
  } catch (error) {
    console.error('❌ Error validating JSDoc:', error.message);
    return false;
  }
}

// Run validation
const success = validateJSDocCoverage();
process.exit(success ? 0 : 1);