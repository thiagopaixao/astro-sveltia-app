/**
 * @fileoverview Test script to validate modular app startup
 */

const { app } = require('electron');

// Mock app ready event for testing
app.whenReady().then(() => {
  console.log('✅ App ready event fired successfully');
  
  // Test modular imports
  try {
    const { getLogger } = require('./src/main/logging/logger.js');
    const { DatabaseManager } = require('./src/main/database/database.js');
    const { WindowManager } = require('./src/main/window/windowManager.js');
    const { ProjectService } = require('./src/application/ProjectService.js');
    const { FileService } = require('./src/main/services/fileService.js');
    const { MenuManager } = require('./src/main/services/menuManager.js');
    const { createIpcRegistry } = require('./src/ipc/index.js');
    
    console.log('✅ All modular imports successful');
    
    // Test logger
    const logger = getLogger('Test');
    logger.info('Logger test successful');
    
    // Test database manager initialization
    const databaseManager = new DatabaseManager({
      userDataPath: app.getPath('userData'),
      dbName: 'test-documental.db'
    });
    console.log('✅ DatabaseManager created successfully');
    
    // Test window manager initialization
    const windowManager = new WindowManager({
      basePath: __dirname,
      userDataPath: app.getPath('userData'),
      windowConfig: {
        width: 900,
        height: 600,
        show: false,
        maximize: true
      }
    });
    console.log('✅ WindowManager created successfully');
    
    // Test service creation
    const projectService = new ProjectService({ logger, databaseManager });
    const fileService = new FileService({ logger, windowManager });
    const menuManager = new MenuManager({ logger, windowManager, fileService });
    console.log('✅ All services created successfully');
    
    // Test IPC registry
    const ipcRegistry = createIpcRegistry({
      logger,
      databaseManager,
      windowManager,
      projectService,
      fileService
    });
    console.log('✅ IPC registry created successfully');
    
    // Test handler registration
    ipcRegistry.registerIpcHandlers();
    console.log('✅ IPC handlers registered successfully');
    
    // Test handler unregistration
    ipcRegistry.unregisterIpcHandlers();
    console.log('✅ IPC handlers unregistered successfully');
    
    console.log('🎉 All modular components working correctly!');
    console.log('📊 Summary:');
    console.log('  - Logger: ✅');
    console.log('  - DatabaseManager: ✅');
    console.log('  - WindowManager: ✅');
    console.log('  - ProjectService: ✅');
    console.log('  - FileService: ✅');
    console.log('  - MenuManager: ✅');
    console.log('  - IPC Registry: ✅');
    console.log('  - Handler Registration: ✅');
    
    app.quit();
    
  } catch (error) {
    console.error('❌ Error in modular test:', error);
    app.quit();
  }
});

// Handle app quit
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('🧪 Starting modular app validation test...');