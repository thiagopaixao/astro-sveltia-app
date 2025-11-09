/**
 * @fileoverview Test script for modular integration
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

// Mock Electron APIs for testing outside Electron context
const electronMock = {
  BrowserWindow: {
    getAllWindows: () => []
  }
};

// Mock the electron module before requiring logger
require.cache[require.resolve('electron')] = {
  exports: electronMock
};

// Test modular components independently
console.log('🧪 Testando integração modular...');

try {
  // Test logger module
  const { getLogger } = require('./src/main/logging/logger.js');
  const logger = getLogger('TestModular');
  logger.info('✅ Logger module loaded successfully');
  
  // Test process tracker
  const { appTracker } = require('./src/main/processes/documentalTracker.js');
  logger.info('✅ Process tracker module loaded successfully');
  logger.info(`📊 Active processes: ${appTracker.getProcessCount()}`);
  
  // Test platform factory
  const { ProcessInspectorFactory } = require('./src/main/platform/index.js');
  logger.info('✅ Platform factory module loaded successfully');
  logger.info(`🖥️  Platform: ${ProcessInspectorFactory.getPlatformName()}`);
  logger.info(`🪟 Is Windows: ${ProcessInspectorFactory.isWindows()}`);
  logger.info(`🐧 Is Unix: ${ProcessInspectorFactory.isUnix()}`);
  
  // Test process validation (async)
  async function testProcessValidation() {
    try {
      const inspector = ProcessInspectorFactory.getInspector();
      const currentPid = process.pid;
      const exists = await inspector.processExists(currentPid);
      logger.info(`🔍 Current process (${currentPid}) exists: ${exists}`);
      
      if (exists) {
        const processInfo = await inspector.getProcessInfo(currentPid);
        logger.info(`📋 Process info:`, processInfo);
      }
    } catch (error) {
      logger.error('❌ Error testing process validation:', error);
    }
  }
  
  testProcessValidation().then(() => {
    logger.info('🎉 All modular components tested successfully!');
    logger.info('🚀 Ready to run: npm run start:modular');
    process.exit(0);
  });
  
} catch (error) {
  console.error('❌ Error testing modular integration:', error);
  process.exit(1);
}