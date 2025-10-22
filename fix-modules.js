#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist', 'linux-unpacked', 'resources', 'app.asar.unpacked', 'node_modules');
const sourceModule = path.join(__dirname, 'node_modules', 'call-bind-apply-helpers');
const targetModule = path.join(distPath, 'call-bind-apply-helpers');

console.log('Fixing module dependencies...');

if (fs.existsSync(sourceModule) && fs.existsSync(distPath)) {
  // Copy the missing module
  if (fs.existsSync(targetModule)) {
    fs.rmSync(targetModule, { recursive: true, force: true });
  }
  
  fs.cpSync(sourceModule, targetModule, { recursive: true });
  console.log('✅ call-bind-apply-helpers copied successfully');
  
  // Also copy other potentially missing modules
  const modulesToCopy = [
    'es-errors',
    'gopd',
    'has-proto',
    'has-symbols'
  ];
  
  modulesToCopy.forEach(mod => {
    const source = path.join(__dirname, 'node_modules', mod);
    const target = path.join(distPath, mod);
    
    if (fs.existsSync(source) && !fs.existsSync(target)) {
      fs.cpSync(source, target, { recursive: true });
      console.log(`✅ ${mod} copied successfully`);
    }
  });
  
  console.log('🎉 Module dependencies fixed!');
} else {
  console.error('❌ Could not fix modules - paths not found');
  process.exit(1);
}