/**
 * @fileoverview Hybrid main process with modular architecture integration
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

// Core Electron imports
const { app, BrowserWindow, ipcMain, Menu, dialog, BrowserView, shell } = require('electron');
const path = require('path');

// Import new modular components
const { getLogger, setLogLevel } = require('./src/main/logging/logger.js');
const { appTracker } = require('./src/main/processes/documentalTracker.js');
const { ProcessInspectorFactory } = require('./src/main/platform/index.js');
const { DatabaseManager } = require('./src/main/database/database.js');
const { WindowManager } = require('./src/main/window/windowManager.js');
const { ProjectService } = require('./src/application/ProjectService.js');
const { createIpcRegistry } = require('./src/ipc/index.js');

// Initialize new modular logging system
const logger = getLogger('MainProcess');
logger.info('🚀 Iniciando aplicação com arquitetura modular híbrida');

// Legacy imports from original main.js (keep for now)
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { spawn } = require('child_process');
const { rimraf } = require('rimraf');
const { execSync } = require('child_process');

// GitHub authentication and git operations
const keytar = require('keytar');
const { Octokit } = require('@octokit/rest');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const GITHUB_CONFIG = require('./github-config');

// Global variables (legacy - will be migrated gradually)
let mainWindow;
let editorView;
let viewerView;
let globalDevServerUrl = null;

// New modular instances
let databaseManager;
let windowManager;
let projectService;
let ipcRegistry;
let activeProcesses = {};

// Legacy app logging buffer (will be replaced by modular logger)
let appLogBuffer = [];
const MAX_LOG_BUFFER_SIZE = 10000;

// Store BrowserViews per window for independent control
const windowBrowserViews = new Map();
let isCleaningUp = false;

// ============================================================================
// MODULAR INTEGRATION: New logging system replaces legacy console override
// ============================================================================

// Override console methods to use new modular logger
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

function addToAppLog(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  // Use new modular logger instead of buffer
  logger[level](message);
  
  // Keep legacy buffer for compatibility during transition
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  appLogBuffer.push(logEntry);
  
  if (appLogBuffer.length > MAX_LOG_BUFFER_SIZE) {
    appLogBuffer = appLogBuffer.slice(-MAX_LOG_BUFFER_SIZE);
  }
  
  // Send to all windows (legacy functionality)
  if (windowManager) {
    const allWindows = windowManager.getAllWindows();
    allWindows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('app-log-output', logEntry);
      }
    });
  }
  
  // Call original console method
  originalConsoleLog(...args);
}

// Override console methods to use modular logging
console.log = function(...args) {
  addToAppLog('info', ...args);
};

console.error = function(...args) {
  addToAppLog('error', ...args);
  originalConsoleError(...args);
};

console.warn = function(...args) {
  addToAppLog('warn', ...args);
  originalConsoleWarn(...args);
};

console.info = function(...args) {
  addToAppLog('info', ...args);
  originalConsoleInfo(...args);
};

// Function to get initial app logs (legacy compatibility)
function getAppLogs() {
  return appLogBuffer.join('');
}

// ============================================================================
// MODULAR INTEGRATION: Process tracking using new DocumentalTracker
// ============================================================================

// Legacy process tracking functions (now delegate to modular tracker)
function loadDocumentalProcesses() {
  logger.info('📂 Carregando processos Documental usando tracker modular');
  return appTracker.loadProcesses();
}

function saveDocumentalProcesses() {
  logger.info('💾 Salvando processos Documental usando tracker modular');
  return appTracker.saveProcesses();
}

function addDocumentalProcess(pid, processInfo) {
  logger.info(`➕ Adicionando processo Documental via tracker modular: PID ${pid}, Port ${processInfo.port}`);
  return appTracker.addProcess(pid, processInfo);
}

function removeDocumentalProcess(pid) {
  logger.info(`➖ Removendo processo Documental via tracker modular: PID ${pid}`);
  return appTracker.removeProcess(pid);
}

// ============================================================================
// MODULAR INTEGRATION: Platform-specific process inspection
// ============================================================================

// Enhanced process validation using new platform inspectors
async function isDocumentalProcess(pid, expectedPort = null) {
  try {
    logger.debug(`🔍 Validando processo Documental: PID ${pid}, Porta esperada: ${expectedPort}`);
    
    // Use new modular platform inspector
    const inspector = ProcessInspectorFactory.getInspector();
    const processExists = await inspector.processExists(pid);
    
    if (!processExists) {
      logger.debug(`❌ Processo ${pid} não existe`);
      return false;
    }
    
    // Get detailed process info
    const processInfo = await inspector.getProcessInfo(pid);
    if (!processInfo) {
      logger.debug(`❌ Não foi possível obter informações do processo ${pid}`);
      return false;
    }
    
    // Check if it's a Node.js process with Documental characteristics
    const isNodeProcess = processInfo.name.toLowerCase().includes('node') || 
                         processInfo.command.toLowerCase().includes('node');
    
    const hasDocumentalArgs = processInfo.command.toLowerCase().includes('documental') ||
                            processInfo.command.toLowerCase().includes('astro') ||
                            processInfo.command.toLowerCase().includes('dev');
    
    const isValid = isNodeProcess && hasDocumentalArgs;
    
    logger.debug(`✅ Processo ${pid} validação: ${isValid ? 'APROVADO' : 'REPROVADO'}`);
    logger.debug(`   - Nome: ${processInfo.name}`);
    logger.debug(`   - Comando: ${processInfo.command}`);
    logger.debug(`   - Memória: ${processInfo.memory} KB`);
    
    return isValid;
  } catch (error) {
    logger.error(`❌ Erro ao validar processo ${pid}:`, error);
    return false;
  }
}

// ============================================================================
// LEGACY FUNCTIONS: Keep original functionality during transition
// ============================================================================

// Global output functions for console communication
function sendCommandOutput(output) {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('command-output', output);
    }
  });
}

function sendServerOutput(output) {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('server-output', output);
    }
  });
}

function sendCommandStatus(status) {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('command-status', status);
    }
  });
}

// ============================================================================
// MODULAR INTEGRATION: Enhanced app initialization
// ============================================================================

// Main app initialization with modular architecture
app.whenReady().then(async () => {
  logger.info('🚀 App ready - initializing with modular architecture');
  
  // Reset cleanup flag
  isCleaningUp = false;
  logger.info('✅ Cleanup flag reset');
  
  // Log platform information
  const platformInfo = {
    platform: ProcessInspectorFactory.getPlatformName(),
    isWindows: ProcessInspectorFactory.isWindows(),
    isUnix: ProcessInspectorFactory.isUnix(),
    isMacOS: ProcessInspectorFactory.isMacOS(),
    isLinux: ProcessInspectorFactory.isLinux()
  };
  logger.info('🖥️  Platform information:', platformInfo);
  
  // Initialize database
  initializeDatabase();
  
  // Create main window
  await createWindow();
  
  // Setup modular IPC handlers
  setupModularIpcHandlers();
  
  // Load previously tracked Documental processes using modular tracker
  loadDocumentalProcesses();
  
  // Validate all tracked processes using new platform inspectors
  logger.info('🔍 Validating tracked Documental processes...');
  const validationResults = await appTracker.validateAllProcesses();
  logger.info(`📊 Validation completed: ${validationResults.valid.length} valid, ${validationResults.invalid.length} removed`);
  
  // Clean up orphaned processes (legacy functionality)
  await cleanupDocumentalOrphanedProcesses();
  
  logger.info('✅ Modular app initialization completed successfully');
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
  logger.info('🪟 All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle activate event (for macOS)
app.on('activate', async () => {
  logger.info('🔄 App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

// Handle app quit event
app.on('before-quit', async () => {
  logger.info('👋 App quitting - cleaning up...');
  isCleaningUp = true;
  
  // Unregister IPC handlers
  if (ipcRegistry) {
    ipcRegistry.unregisterIpcHandlers();
  }
  
  // Cleanup BrowserViews
  if (windowManager) {
    const allWindows = windowManager.getAllWindows();
    allWindows.forEach(window => {
      if (window && !window.isDestroyed()) {
        // BrowserViews will be cleaned up by window manager
      }
    });
  }
  
  // Save any pending data
  saveDocumentalProcesses();
  
  logger.info('✅ Cleanup completed');
});

// ============================================================================
// WINDOW MANAGEMENT: Migrated from main.js with modular logging
// ============================================================================

function initializeDatabase() {
  logger.info('🗄️ Initializing database with modular DatabaseManager');
  
  databaseManager = new DatabaseManager({
    userDataPath: app.getPath('userData'),
    dbName: 'documental.db'
  });
  
  return databaseManager.initialize()
    .then(() => {
      logger.info('✅ Database initialized successfully');
      return databaseManager.getDatabase();
    })
    .catch((err) => {
      logger.error('❌ Failed to initialize database:', err);
      throw err;
    });
}

async function createWindow() {
  logger.info('🪟 Creating main window with modular WindowManager');
  
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
  
  mainWindow = await windowManager.createMainWindow();
  
  logger.info('✅ Main window created and shown successfully');
  return mainWindow;
}

// ============================================================================
// MODULAR IPC HANDLERS: New modular IPC structure
// ============================================================================

function setupModularIpcHandlers() {
  logger.info('🔌 Setting up modular IPC handlers...');

  try {
    // Initialize project service
    projectService = new ProjectService({
      logger,
      databaseManager
    });

    // Create IPC registry with all dependencies
    ipcRegistry = createIpcRegistry({
      logger,
      databaseManager,
      windowManager,
      projectService
    });

    // Register all IPC handlers
    ipcRegistry.registerIpcHandlers();

    logger.info('✅ Modular IPC handlers configured successfully');
  } catch (error) {
    logger.error('❌ Failed to setup modular IPC handlers:', error);
    throw error;
  }
}

// ============================================================================
// LEGACY IPC HANDLERS: Keep for backward compatibility during transition
// ============================================================================

function setupIpcHandlers() {
  logger.info('🔌 Setting up legacy IPC handlers with modular logging');

  ipcMain.handle('get-home-directory', () => {
    return app.getPath('home');
  });

  ipcMain.handle('open-directory-dialog', async () => {
    if (!windowManager || !windowManager.hasValidMainWindow()) {
      logger.warn('⚠️ No valid main window for directory dialog');
      return null;
    }
    
    const { canceled, filePaths } = await dialog.showOpenDialog(windowManager.getMainWindow(), {
      properties: ['openDirectory']
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  // Add more essential IPC handlers as needed
  logger.info('✅ Legacy IPC handlers configured successfully');
}

// ============================================================================
// LEGACY FUNCTION STUBS: These will be migrated gradually
// ============================================================================

// Placeholder for legacy cleanup function (will be enhanced with modular approach)
async function cleanupDocumentalOrphanedProcesses() {
  logger.info('🧹 Limpando processos Documental órfãos (legado)');
  // This function will be enhanced to use new modular process validation
}

function createEditorView() {
  logger.info('📝 Criando editor view (legado)');
  // Legacy editor view creation - will be migrated
}

function createViewerView() {
  logger.info('👁️  Criando viewer view (legado)');
  // Legacy viewer view creation - will be migrated
}

// Placeholder for window creation functions (will be migrated to window module)
function createMainWindow() {
  logger.info('🪟 Criando janela principal (legado)');
  // Legacy window creation logic
}

function createEditorView() {
  logger.info('📝 Criando editor view (legado)');
  // Legacy editor view creation
}

function createViewerView() {
  logger.info('👁️  Criando viewer view (legado)');
  // Legacy viewer view creation
}

// Placeholder for IPC handlers (will be migrated to IPC module)
function setupIpcHandlers() {
  logger.info('🔌 Configurando handlers IPC (legado)');
  // Legacy IPC setup
}

// ============================================================================
// MODULAR INTEGRATION: Enhanced error handling and monitoring
// ============================================================================

// Enhanced error handling using modular logger
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  // Continue with legacy error handling
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  // Continue with legacy error handling
});

// ============================================================================
// EXPORT: Make functions available for legacy imports
// ============================================================================

// Export functions that might be imported by other legacy modules
module.exports = {
  // Legacy exports for compatibility
  mainWindow,
  editorView,
  viewerView,
  globalDevServerUrl,
  activeProcesses,
  appLogBuffer,
  getAppLogs,
  sendCommandOutput,
  sendServerOutput,
  sendCommandStatus,
  createMainWindow,
  createEditorView,
  createViewerView,
  setupIpcHandlers,
  
  // New modular exports
  logger,
  appTracker,
  ProcessInspectorFactory,
  databaseManager,
  windowManager,
  projectService,
  ipcRegistry,
  
  // Process tracking functions
  loadDocumentalProcesses,
  saveDocumentalProcesses,
  addDocumentalProcess,
  removeDocumentalProcess,
  isDocumentalProcess
};

// Log successful initialization
logger.info('✅ Main.js híbrido carregado com sucesso');
logger.info('🔧 Módulos integrados: Logging, Process Tracker, Platform Inspectors');
logger.info('🔄 Sistema pronto para migração gradual');