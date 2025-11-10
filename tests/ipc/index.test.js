/**
 * @fileoverview Tests for IpcRegistry class
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IpcRegistry, createIpcRegistry } from '../../src/ipc/index.js';

// Mock all handler modules
vi.mock('../../src/ipc/auth.js', () => ({
  AuthHandlers: vi.fn().mockImplementation(() => ({
    registerHandlers: vi.fn(),
    unregisterHandlers: vi.fn()
  }))
}));

vi.mock('../../src/ipc/projects.js', () => ({
  ProjectHandlers: vi.fn().mockImplementation(() => ({
    registerHandlers: vi.fn(),
    unregisterHandlers: vi.fn()
  }))
}));

vi.mock('../../src/ipc/git.js', () => ({
  GitHandlers: vi.fn().mockImplementation(() => ({
    registerHandlers: vi.fn(),
    unregisterHandlers: vi.fn()
  }))
}));

vi.mock('../../src/ipc/browser.js', () => ({
  BrowserHandlers: vi.fn().mockImplementation(() => ({
    registerHandlers: vi.fn(),
    unregisterHandlers: vi.fn()
  }))
}));

vi.mock('../../src/ipc/system.js', () => ({
  SystemHandlers: vi.fn().mockImplementation(() => ({
    registerHandlers: vi.fn(),
    unregisterHandlers: vi.fn()
  }))
}));

describe('IpcRegistry', () => {
  let ipcRegistry;
  let mockDependencies;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockDependencies = {
      logger: mockLogger,
      databaseManager: {},
      windowManager: {},
      projectService: {}
    };

    ipcRegistry = new IpcRegistry(mockDependencies);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with dependencies', () => {
      expect(ipcRegistry.dependencies).toBe(mockDependencies);
      expect(ipcRegistry.logger).toBe(mockLogger);
      expect(ipcRegistry.isRegistered).toBe(false);
    });

    it('should initialize all handler instances', () => {
      const { AuthHandlers, ProjectHandlers, GitHandlers, BrowserHandlers, SystemHandlers } = require('../../src/ipc/index.js');
      
      expect(AuthHandlers).toHaveBeenCalledWith(mockDependencies);
      expect(ProjectHandlers).toHaveBeenCalledWith(mockDependencies);
      expect(GitHandlers).toHaveBeenCalledWith(mockDependencies);
      expect(BrowserHandlers).toHaveBeenCalledWith(mockDependencies);
      expect(SystemHandlers).toHaveBeenCalledWith(mockDependencies);
      
      expect(ipcRegistry.authHandlers).toBeDefined();
      expect(ipcRegistry.projectHandlers).toBeDefined();
      expect(ipcRegistry.gitHandlers).toBeDefined();
      expect(ipcRegistry.browserHandlers).toBeDefined();
      expect(ipcRegistry.systemHandlers).toBeDefined();
    });
  });

  describe('registerIpcHandlers', () => {
    it('should register all handlers in correct order', () => {
      ipcRegistry.registerIpcHandlers();
      
      expect(ipcRegistry.systemHandlers.registerHandlers).toHaveBeenCalledBefore(
        ipcRegistry.authHandlers.registerHandlers
      );
      expect(ipcRegistry.authHandlers.registerHandlers).toHaveBeenCalledBefore(
        ipcRegistry.projectHandlers.registerHandlers
      );
      expect(ipcRegistry.projectHandlers.registerHandlers).toHaveBeenCalledBefore(
        ipcRegistry.gitHandlers.registerHandlers
      );
      expect(ipcRegistry.gitHandlers.registerHandlers).toHaveBeenCalledBefore(
        ipcRegistry.browserHandlers.registerHandlers
      );
      
      expect(ipcRegistry.isRegistered).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('🔌 Registering all IPC handlers...');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ All IPC handlers registered successfully');
    });

    it('should log registration summary', () => {
      ipcRegistry.registerIpcHandlers();
      
      expect(mockLogger.info).toHaveBeenCalledWith('📋 Registered IPC handlers summary:');
      expect(mockLogger.info).toHaveBeenCalledWith('  📁 System handlers registered');
      expect(mockLogger.info).toHaveBeenCalledWith('  🔐 Authentication handlers registered');
      expect(mockLogger.info).toHaveBeenCalledWith('  📁 Projects handlers registered');
      expect(mockLogger.info).toHaveBeenCalledWith('  🔧 Git handlers registered');
      expect(mockLogger.info).toHaveBeenCalledWith('  🌐 Browser handlers registered');
      expect(mockLogger.info).toHaveBeenCalledWith('🔢 Total: 5 handler categories registered');
    });

    it('should warn if already registered', () => {
      ipcRegistry.isRegistered = true;
      
      ipcRegistry.registerIpcHandlers();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ IPC handlers already registered');
      expect(ipcRegistry.authHandlers.registerHandlers).not.toHaveBeenCalled();
    });

    it('should handle registration errors', () => {
      const error = new Error('Registration failed');
      ipcRegistry.systemHandlers.registerHandlers.mockImplementation(() => {
        throw error;
      });
      
      expect(() => ipcRegistry.registerIpcHandlers()).toThrow('Registration failed');
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Failed to register IPC handlers:', error);
      expect(ipcRegistry.isRegistered).toBe(false);
    });
  });

  describe('unregisterIpcHandlers', () => {
    beforeEach(() => {
      ipcRegistry.isRegistered = true;
    });

    it('should unregister all handlers in reverse order', () => {
      ipcRegistry.unregisterIpcHandlers();
      
      expect(ipcRegistry.browserHandlers.unregisterHandlers).toHaveBeenCalledBefore(
        ipcRegistry.gitHandlers.unregisterHandlers
      );
      expect(ipcRegistry.gitHandlers.unregisterHandlers).toHaveBeenCalledBefore(
        ipcRegistry.projectHandlers.unregisterHandlers
      );
      expect(ipcRegistry.projectHandlers.unregisterHandlers).toHaveBeenCalledBefore(
        ipcRegistry.authHandlers.unregisterHandlers
      );
      expect(ipcRegistry.authHandlers.unregisterHandlers).toHaveBeenCalledBefore(
        ipcRegistry.systemHandlers.unregisterHandlers
      );
      
      expect(ipcRegistry.isRegistered).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('🔌 Unregistering all IPC handlers...');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ All IPC handlers unregistered successfully');
    });

    it('should warn if not registered', () => {
      ipcRegistry.isRegistered = false;
      
      ipcRegistry.unregisterIpcHandlers();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ IPC handlers not registered');
      expect(ipcRegistry.authHandlers.unregisterHandlers).not.toHaveBeenCalled();
    });

    it('should handle unregistration errors', () => {
      const error = new Error('Unregistration failed');
      ipcRegistry.browserHandlers.unregisterHandlers.mockImplementation(() => {
        throw error;
      });
      
      expect(() => ipcRegistry.unregisterIpcHandlers()).toThrow('Unregistration failed');
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Failed to unregister IPC handlers:', error);
      expect(ipcRegistry.isRegistered).toBe(true);
    });
  });

  describe('getHandlers', () => {
    it('should return all handler instances', () => {
      const handlers = ipcRegistry.getHandlers();
      
      expect(handlers).toEqual({
        auth: ipcRegistry.authHandlers,
        projects: ipcRegistry.projectHandlers,
        git: ipcRegistry.gitHandlers,
        browser: ipcRegistry.browserHandlers,
        system: ipcRegistry.systemHandlers
      });
    });
  });

  describe('isHandlersRegistered', () => {
    it('should return registration status', () => {
      expect(ipcRegistry.isHandlersRegistered()).toBe(false);
      
      ipcRegistry.isRegistered = true;
      expect(ipcRegistry.isHandlersRegistered()).toBe(true);
    });
  });

  describe('reregisterIpcHandlers', () => {
    it('should re-register handlers', () => {
      ipcRegistry.isRegistered = true;
      
      ipcRegistry.reregisterIpcHandlers();
      
      expect(mockLogger.info).toHaveBeenCalledWith('🔄 Re-registering IPC handlers...');
      expect(ipcRegistry.authHandlers.unregisterHandlers).toHaveBeenCalled();
      expect(ipcRegistry.authHandlers.registerHandlers).toHaveBeenCalled();
      expect(ipcRegistry.isRegistered).toBe(true);
    });

    it('should register if not already registered', () => {
      ipcRegistry.isRegistered = false;
      
      ipcRegistry.reregisterIpcHandlers();
      
      expect(mockLogger.info).toHaveBeenCalledWith('🔄 Re-registering IPC handlers...');
      expect(ipcRegistry.authHandlers.unregisterHandlers).not.toHaveBeenCalled();
      expect(ipcRegistry.authHandlers.registerHandlers).toHaveBeenCalled();
      expect(ipcRegistry.isRegistered).toBe(true);
    });
  });

  describe('getHandlerStats', () => {
    it('should return handler statistics', () => {
      const stats = ipcRegistry.getHandlerStats();
      
      expect(stats).toEqual({
        isRegistered: false,
        handlerCount: 5,
        categories: ['System', 'Authentication', 'Projects', 'Git', 'Browser'],
        registrationTime: expect.any(String)
      });
      
      // Check that registrationTime is a valid ISO string
      expect(new Date(stats.registrationTime)).toBeInstanceOf(Date);
    });

    it('should reflect current registration status', () => {
      ipcRegistry.isRegistered = true;
      
      const stats = ipcRegistry.getHandlerStats();
      
      expect(stats.isRegistered).toBe(true);
    });
  });
});

describe('createIpcRegistry', () => {
  let mockDependencies;

  beforeEach(() => {
    mockDependencies = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    };
  });

  it('should create IpcRegistry instance with valid dependencies', () => {
    const registry = createIpcRegistry(mockDependencies);
    
    expect(registry).toBeInstanceOf(IpcRegistry);
    expect(registry.logger).toBe(mockDependencies.logger);
  });

  it('should throw error if logger is missing', () => {
    expect(() => createIpcRegistry({})).toThrow('Logger is required in dependencies');
  });

  it('should throw error if logger is null', () => {
    expect(() => createIpcRegistry({ logger: null })).toThrow('Logger is required in dependencies');
  });

  it('should throw error if logger is undefined', () => {
    expect(() => createIpcRegistry({ logger: undefined })).toThrow('Logger is required in dependencies');
  });
});

describe('IpcRegistry Integration', () => {
  let ipcRegistry;
  let mockDependencies;

  beforeEach(() => {
    mockDependencies = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      },
      databaseManager: {},
      windowManager: {},
      projectService: {}
    };

    ipcRegistry = new IpcRegistry(mockDependencies);
    vi.clearAllMocks();
  });

  it('should complete full registration cycle', () => {
    // Initial state
    expect(ipcRegistry.isHandlersRegistered()).toBe(false);
    
    // Register handlers
    ipcRegistry.registerIpcHandlers();
    expect(ipcRegistry.isHandlersRegistered()).toBe(true);
    
    // Get stats
    const stats = ipcRegistry.getHandlerStats();
    expect(stats.isRegistered).toBe(true);
    
    // Get handlers
    const handlers = ipcRegistry.getHandlers();
    expect(Object.keys(handlers)).toHaveLength(5);
    
    // Unregister handlers
    ipcRegistry.unregisterIpcHandlers();
    expect(ipcRegistry.isHandlersRegistered()).toBe(false);
  });

  it('should handle re-registration correctly', () => {
    // Register first time
    ipcRegistry.registerIpcHandlers();
    expect(mockLogger.warn).not.toHaveBeenCalledWith('⚠️ IPC handlers already registered');
    
    // Try to register again
    ipcRegistry.registerIpcHandlers();
    expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ IPC handlers already registered');
    
    // Re-register
    ipcRegistry.reregisterIpcHandlers();
    expect(mockLogger.info).toHaveBeenCalledWith('🔄 Re-registering IPC handlers...');
    expect(ipcRegistry.isHandlersRegistered()).toBe(true);
  });
});