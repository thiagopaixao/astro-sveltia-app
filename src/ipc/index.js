/**
 * @fileoverview Central registry for all IPC handlers
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { AuthHandlers } = require('./auth.js');
const { ProjectHandlers } = require('./projects.js');
const { GitHandlers } = require('./git.js');
const { BrowserHandlers } = require('./browser.js');
const { SystemHandlers } = require('./system.js');
const { FileHandlers } = require('./file.js');
const { ProjectCreationHandler } = require('./projectCreation.js');

/**
 * IPC Registry - Central point for registering all IPC handlers
 */
class IpcRegistry {
  /**
   * Create an instance of IpcRegistry
   * @param {Object} dependencies - Dependency injection container
   */
  constructor(dependencies) {
    this.dependencies = dependencies;
    this.logger = dependencies.logger;
    
    // Initialize handler instances
    this.authHandlers = new AuthHandlers(dependencies);
    this.projectHandlers = new ProjectHandlers(dependencies);
    this.gitHandlers = new GitHandlers(dependencies);
    this.browserHandlers = new BrowserHandlers(dependencies);
    this.fileHandlers = new FileHandlers(dependencies);
    this.projectCreationHandler = new ProjectCreationHandler(dependencies);
    
    // Initialize SystemHandlers with ProcessManager from ProjectCreationHandler
    this.systemHandlers = new SystemHandlers({
      ...dependencies,
      processManager: this.projectCreationHandler.processManager
    });
    
    this.isRegistered = false;
  }

  /**
   * Register all IPC handlers
   * This should be called during app initialization
   */
  registerIpcHandlers() {
    if (this.isRegistered) {
      this.logger.warn('⚠️ IPC handlers already registered');
      return;
    }

    this.logger.info('🔌 Registering all IPC handlers...');

    try {
      // Register handlers in logical order
      this.systemHandlers.registerHandlers();
      this.authHandlers.registerHandlers();
      this.projectHandlers.registerHandlers();
      this.gitHandlers.registerHandlers();
      this.browserHandlers.registerHandlers();
      this.fileHandlers.registerHandlers();
      this.projectCreationHandler.registerHandlers();

      this.isRegistered = true;
      this.logger.info('✅ All IPC handlers registered successfully');
      
      // Log summary of registered handlers
      this.logRegisteredHandlers();
      
    } catch (error) {
      this.logger.error('❌ Failed to register IPC handlers:', error);
      throw error;
    }
  }

  /**
   * Unregister all IPC handlers
   * This should be called during app cleanup
   */
  unregisterIpcHandlers() {
    if (!this.isRegistered) {
      this.logger.warn('⚠️ IPC handlers not registered');
      return;
    }

    this.logger.info('🔌 Unregistering all IPC handlers...');

    try {
      // Unregister handlers in reverse order
      this.projectCreationHandler.unregisterHandlers();
      this.fileHandlers.unregisterHandlers();
      this.browserHandlers.unregisterHandlers();
      this.gitHandlers.unregisterHandlers();
      this.projectHandlers.unregisterHandlers();
      this.authHandlers.unregisterHandlers();
      this.systemHandlers.unregisterHandlers();

      this.isRegistered = false;
      this.logger.info('✅ All IPC handlers unregistered successfully');
      
    } catch (error) {
      this.logger.error('❌ Failed to unregister IPC handlers:', error);
      throw error;
    }
  }

  /**
   * Get handler instances for direct access if needed
   * @returns {Object} Object containing all handler instances
   */
  getHandlers() {
    return {
      auth: this.authHandlers,
      projects: this.projectHandlers,
      git: this.gitHandlers,
      browser: this.browserHandlers,
      system: this.systemHandlers,
      file: this.fileHandlers,
      projectCreation: this.projectCreationHandler
    };
  }

  /**
   * Log summary of registered handlers
   */
  logRegisteredHandlers() {
    this.logger.info('📋 Registered IPC handlers summary:');
    
    const handlerCategories = [
      { name: 'System', handlers: this.systemHandlers },
      { name: 'Authentication', handlers: this.authHandlers },
      { name: 'Projects', handlers: this.projectHandlers },
      { name: 'Git', handlers: this.gitHandlers },
      { name: 'Browser', handlers: this.browserHandlers },
      { name: 'File', handlers: this.fileHandlers },
      { name: 'Project Creation', handlers: this.projectCreationHandler }
    ];

    handlerCategories.forEach(category => {
      this.logger.info(`  📁 ${category.name} handlers registered`);
    });

    this.logger.info(`🔢 Total: ${handlerCategories.length} handler categories registered`);
  }

  /**
   * Check if IPC handlers are registered
   * @returns {boolean} Whether handlers are registered
   */
  isHandlersRegistered() {
    return this.isRegistered;
  }

  /**
   * Re-register all handlers (useful for development hot-reload)
   */
  reregisterIpcHandlers() {
    this.logger.info('🔄 Re-registering IPC handlers...');
    
    if (this.isRegistered) {
      this.unregisterIpcHandlers();
    }
    
    this.registerIpcHandlers();
  }

  /**
   * Get statistics about registered handlers
   * @returns {Object} Statistics object
   */
  getHandlerStats() {
    return {
      isRegistered: this.isRegistered,
      handlerCount: 7,
      categories: [
        'System',
        'Authentication', 
        'Projects',
        'Git',
        'Browser',
        'File',
        'Project Creation'
      ],
      registrationTime: new Date().toISOString()
    };
  }
}

/**
 * Factory function to create and configure IPC registry
 * @param {Object} dependencies - Dependency injection container
 * @returns {IpcRegistry} Configured IPC registry instance
 */
function createIpcRegistry(dependencies) {
  if (!dependencies.logger) {
    throw new Error('Logger is required in dependencies');
  }
  
  return new IpcRegistry(dependencies);
}

module.exports = {
  IpcRegistry,
  createIpcRegistry
};