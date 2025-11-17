/**
 * @fileoverview Production main process with pure modular architecture
 * @author Documental Team
 * @since 1.0.0
 */

// Load environment variables FIRST - before any other imports
require('dotenv').config();

'use strict';

// Core Electron imports
const { app } = require('electron');

// Import modular components
const { getLogger } = require('./src/main/logging/logger.js');
const { appTracker } = require('./src/main/processes/documentalTracker.js');
const { ProcessInspectorFactory } = require('./src/main/platform/index.js');
const { DatabaseManager } = require('./src/main/database/database.js');
const { WindowManager } = require('./src/main/window/windowManager.js');
const { ProjectService } = require('./src/application/ProjectService.js');
const { FileService } = require('./src/main/services/fileService.js');
const { MenuManager } = require('./src/main/services/menuManager.js');
const { NodeDetectionService } = require('./src/main/services/nodeDetectionService.js');
const { createIpcRegistry } = require('./src/ipc/index.js');

// Initialize modular logging system
const logger = getLogger('MainProcess');
logger.info('🚀 Starting Documental with production modular architecture');

// Modular service instances
let databaseManager;
let windowManager;
let projectService;
let fileService;
let menuManager;
let nodeDetectionService;
let ipcRegistry;

// Application state
let isInitialized = false;
let isCleaningUp = false;

/**
 * Initialize core services
 */
async function initializeServices() {
  logger.info('🔧 Initializing core services...');

  try {
    // Initialize database
    logger.info('🗄️ Initializing database...');
    databaseManager = new DatabaseManager({
      userDataPath: app.getPath('userData'),
      dbName: 'documental.db'
    });
    await databaseManager.initialize();
    logger.info('✅ Database initialized');

    // Initialize window manager
    logger.info('🪟 Initializing window manager...');
    windowManager = new WindowManager({
      basePath: __dirname,
      userDataPath: app.getPath('userData'),
      windowConfig: {
        width: 900,
        height: 600,
        show: false,
        maximize: true
      }
    });
    logger.info('✅ Window manager initialized');

    // Initialize project service
    logger.info('📁 Initializing project service...');
    projectService = new ProjectService({
      logger,
      databaseManager
    });
    logger.info('✅ Project service initialized');

    // Initialize file service
    logger.info('📂 Initializing file service...');
    fileService = new FileService({
      logger,
      windowManager
    });
    logger.info('✅ File service initialized');

    // Initialize menu manager
    logger.info('🍽️ Initializing menu manager...');
    menuManager = new MenuManager({
      logger,
      windowManager,
      fileService
    });
    menuManager.initialize();
    logger.info('✅ Menu manager initialized');

    // Initialize Node.js detection service
    logger.info('🟢 Initializing Node.js detection service...');
    nodeDetectionService = new NodeDetectionService({
      logger
    });
    logger.info('✅ Node.js detection service initialized');

    // Initialize IPC registry
    logger.info('🔌 Initializing IPC registry...');
    ipcRegistry = createIpcRegistry({
      logger,
      databaseManager,
      windowManager,
      projectService,
      fileService,
      nodeDetectionService
    });
    ipcRegistry.registerIpcHandlers();
    logger.info('✅ IPC registry initialized');

    logger.info('✅ All core services initialized successfully');
    isInitialized = true;

  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Check if welcome setup has been completed
 * @returns {Promise<boolean>} True if setup is completed
 */
async function checkWelcomeSetupCompleted() {
  try {
    const fs = require('fs');
    const path = require('path');
    const firstTimeFile = path.join(app.getPath('userData'), '.first-time');
    
    logger.info(`🔍 Checking welcome setup completion at: ${firstTimeFile}`);
    
    if (fs.existsSync(firstTimeFile)) {
      const content = fs.readFileSync(firstTimeFile, 'utf8').trim();
      const isCompleted = content === 'completed';
      logger.info(`📋 Setup file exists with content: "${content}", completed: ${isCompleted}`);
      return isCompleted;
    } else {
      logger.info('📝 No setup completion file found');
      return false;
    }
  } catch (error) {
    logger.error('❌ Error checking setup completion:', error);
    return false;
  }
}

/**
 * Check Node.js setup and create appropriate window
 */
async function createInitialWindow() {
  try {
    logger.info('🔍 Checking initial window requirements...');
    
    // FIRST: Check if welcome setup has been completed
    const setupCompleted = await checkWelcomeSetupCompleted();
    
    if (setupCompleted) {
      logger.info('✅ Welcome setup already completed - showing main window');
      return await windowManager.createMainWindow();
    }
    
    logger.info('👋 Welcome setup not completed - checking Node.js setup...');
    
    // SECOND: Check Node.js detection (managed runtime ensures Node availability)
    const detection = await nodeDetectionService.detectNodeInstallation();
    logger.info('🔍 Node.js detection result:', detection);
    
    // ALWAYS show welcome window on first run for Node.js verification
    logger.info('👋 First time setup - showing welcome window for Node.js verification');
    
    // Store detection result for the welcome window to use
    global.nodeDetectionResult = detection;
    
    return await windowManager.createWindow('welcome.html', {
      width: 900,
      height: 700,
      resizable: true,
      maximizable: true,
      minimizable: true,
      maximize: true
    });
    
    // FOURTH: Otherwise, show welcome window with Node.js setup step
    logger.info('⚙️ Node.js setup required, showing welcome window');
    return await windowManager.createWindow('welcome.html', {
      width: 900,
      height: 700,
      resizable: true,
      maximizable: true,
      minimizable: true,
      maximize: true
    });
    
  } catch (error) {
    logger.error('❌ Failed to create initial window:', error);
    throw error;
  }
}

/**
 * Create main window
 */
async function createMainWindow() {
  try {
    logger.info('🪟 Creating main window...');
    const mainWindow = await windowManager.createMainWindow();
    logger.info('✅ Main window created successfully');
    return mainWindow;
  } catch (error) {
    logger.error('❌ Failed to create main window:', error);
    throw error;
  }
}

/**
 * Load and validate tracked processes
 */
async function initializeProcessTracking() {
  try {
    logger.info('📊 Initializing process tracking...');

    // Load previously tracked processes
    await appTracker.loadProcesses();
    logger.info('✅ Process tracking data loaded');

    // Validate all tracked processes
    const validationResults = await appTracker.validateAllProcesses();
    logger.info(`📊 Process validation completed: ${validationResults.valid.length} valid, ${validationResults.invalid.length} removed`);

    logger.info('✅ Process tracking initialized');
  } catch (error) {
    logger.error('❌ Failed to initialize process tracking:', error);
    // Don't throw - process tracking failure shouldn't stop app startup
  }
}

/**
 * Setup application event handlers
 */
function setupAppEventHandlers() {
  logger.info('🔗 Setting up application event handlers...');

  // App ready event
  app.whenReady().then(async () => {
    try {
      logger.info('🚀 App ready - starting initialization...');
      
      // Reset cleanup flag
      isCleaningUp = false;
      
      // Log platform information
      const platformInfo = {
        platform: ProcessInspectorFactory.getPlatformName(),
        isWindows: ProcessInspectorFactory.isWindows(),
        isUnix: ProcessInspectorFactory.isUnix(),
        isMacOS: ProcessInspectorFactory.isMacOS(),
        isLinux: ProcessInspectorFactory.isLinux()
      };
      logger.info('🖥️ Platform information:', platformInfo);
      
      // Initialize services
      await initializeServices();
      
      // Create initial window (main or node-setup based on detection)
      await createInitialWindow();
      
      // Initialize process tracking
      await initializeProcessTracking();
      
      logger.info('✅ Application initialization completed successfully');
      
    } catch (error) {
      logger.error('❌ Application initialization failed:', error);
      app.quit();
    }
  });

  // Window all closed event
  app.on('window-all-closed', () => {
    logger.info('🪟 All windows closed');
    // Add delay to prevent immediate quit during navigation
    setTimeout(() => {
      if (process.platform !== 'darwin') {
        logger.info('🚪 Quitting app after delay');
        app.quit();
      }
    }, 1000); // 1 second delay
  });

  // Activate event (for macOS)
  app.on('activate', async () => {
    logger.info('🔄 App activated');
    if (windowManager && windowManager.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });

  // Before quit event
  app.on('before-quit', async () => {
    if (isCleaningUp) {
      return; // Prevent multiple cleanup attempts
    }

    logger.info('👋 App quitting - cleaning up...');
    isCleaningUp = true;

    try {
      // Cleanup services in reverse order
      if (ipcRegistry) {
        ipcRegistry.unregisterIpcHandlers();
        logger.info('✅ IPC handlers unregistered');
      }

      if (menuManager) {
        menuManager.cleanup();
        logger.info('✅ Menu manager cleaned up');
      }

      if (appTracker) {
        await appTracker.saveProcesses();
        logger.info('✅ Process tracking data saved');
      }

      if (databaseManager) {
        await databaseManager.close();
        logger.info('✅ Database closed');
      }

      logger.info('✅ Application cleanup completed successfully');
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
    }
  });

  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error);
    // Continue execution but log the error
  });

  // Unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    // Continue execution but log the error
  });

  logger.info('✅ Application event handlers configured');
}

/**
 * Get service instances (for debugging or external access)
 * @returns {Object} Service instances
 */
function getServices() {
  return {
    databaseManager,
    windowManager,
    projectService,
    fileService,
    menuManager,
    ipcRegistry,
    appTracker,
    logger
  };
}

/**
 * Get application status
 * @returns {Object} Application status
 */
function getApplicationStatus() {
  return {
    isInitialized,
    isCleaningUp,
    platform: ProcessInspectorFactory.getPlatformName(),
    version: app.getVersion(),
    services: {
      database: !!databaseManager,
      windowManager: !!windowManager,
      projectService: !!projectService,
      fileService: !!fileService,
      menuManager: !!menuManager,
      ipcRegistry: !!ipcRegistry
    }
  };
}

// Initialize application
setupAppEventHandlers();

// Log successful startup
logger.info('✅ Production modular main process loaded successfully');
logger.info('🔧 Architecture: Pure modular with dependency injection');
logger.info('📦 Services: Database, Window, Project, File, Menu, IPC');

// Export for testing or debugging (only in development)
if (process.env.NODE_ENV === 'development') {
  module.exports = {
    getServices,
    getApplicationStatus,
    // Expose for testing
    _private: {
      initializeServices,
      createMainWindow,
      initializeProcessTracking,
      setupAppEventHandlers
    }
  };
}