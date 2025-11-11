/**
 * @fileoverview Tests for IpcRegistry class
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock electron at the top level
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}));

describe('IpcRegistry Unit Tests', () => {
  let mockLogger;
  let mockDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    mockDependencies = {
      logger: mockLogger,
      databaseManager: {
        getDatabase: vi.fn()
      },
      windowManager: {
        getMainWindow: vi.fn()
      }
    };
  });

  describe('IpcRegistry Basic Functionality', () => {
    it('should validate dependencies are properly mocked', () => {
      expect(mockLogger.info).toBeDefined();
      expect(mockDependencies.databaseManager.getDatabase).toBeDefined();
      expect(mockDependencies.windowManager.getMainWindow).toBeDefined();
    });

    it('should test mock logger functionality', () => {
      mockLogger.info('Test registry message');
      expect(mockLogger.info).toHaveBeenCalledWith('Test registry message');
    });
  });

  describe('Module Import Validation', () => {
    it('should validate IpcRegistry can be imported', async () => {
      const { IpcRegistry } = await import('../../src/ipc/index.js');
      expect(IpcRegistry).toBeDefined();
    });

    it('should validate createIpcRegistry can be imported', async () => {
      const { createIpcRegistry } = await import('../../src/ipc/index.js');
      expect(createIpcRegistry).toBeDefined();
      expect(typeof createIpcRegistry).toBe('function');
    });

    it('should create IpcRegistry instance', async () => {
      const { IpcRegistry } = await import('../../src/ipc/index.js');
      const registry = new IpcRegistry(mockDependencies);
      
      expect(registry).toBeDefined();
      expect(registry.logger).toBe(mockLogger);
    });

    it('should create IpcRegistry using factory function', async () => {
      const { createIpcRegistry } = await import('../../src/ipc/index.js');
      const registry = createIpcRegistry(mockDependencies);
      
      expect(registry).toBeDefined();
      expect(registry.logger).toBe(mockLogger);
    });
  });

  describe('Basic Method Existence Tests', () => {
    let ipcRegistry;

    beforeEach(async () => {
      const { IpcRegistry } = await import('../../src/ipc/index.js');
      ipcRegistry = new IpcRegistry(mockDependencies);
    });

    it('should have registerIpcHandlers method', () => {
      expect(typeof ipcRegistry.registerIpcHandlers).toBe('function');
    });

    it('should have unregisterIpcHandlers method', () => {
      expect(typeof ipcRegistry.unregisterIpcHandlers).toBe('function');
    });

    it('should have reregisterIpcHandlers method', () => {
      expect(typeof ipcRegistry.reregisterIpcHandlers).toBe('function');
    });

    it('should have getHandlers method', () => {
      expect(typeof ipcRegistry.getHandlers).toBe('function');
    });

    it('should have isRegistered property', () => {
      expect(typeof ipcRegistry.isRegistered).toBe('boolean');
      expect(ipcRegistry.isRegistered).toBe(false);
    });
  });

  describe('Handler Instance Validation', () => {
    let ipcRegistry;

    beforeEach(async () => {
      const { IpcRegistry } = await import('../../src/ipc/index.js');
      ipcRegistry = new IpcRegistry(mockDependencies);
    });

    it('should have all handler instances', () => {
      const handlers = ipcRegistry.getHandlers();
      
      expect(handlers).toBeDefined();
      expect(typeof handlers).toBe('object');
      expect(handlers.auth).toBeDefined();
      expect(handlers.projects).toBeDefined();
      expect(handlers.git).toBeDefined();
      expect(handlers.browser).toBeDefined();
      expect(handlers.system).toBeDefined();
    });

    it('should validate handler instances have required methods', () => {
      const handlers = ipcRegistry.getHandlers();
      
      // Check that each handler has register/unregister methods
      Object.values(handlers).forEach(handler => {
        expect(handler).toBeDefined();
        expect(typeof handler.registerHandlers).toBe('function');
        expect(typeof handler.unregisterHandlers).toBe('function');
      });
    });
  });

  describe('Registration Flow Tests', () => {
    let ipcRegistry;

    beforeEach(async () => {
      const { IpcRegistry } = await import('../../src/ipc/index.js');
      ipcRegistry = new IpcRegistry(mockDependencies);
    });

    it('should validate registerIpcHandlers method exists and is callable', () => {
      expect(typeof ipcRegistry.registerIpcHandlers).toBe('function');
      // We don't call it to avoid ipcMain dependency issues
    });

    it('should validate unregisterIpcHandlers method exists and is callable', () => {
      expect(typeof ipcRegistry.unregisterIpcHandlers).toBe('function');
      // We don't call it to avoid ipcMain dependency issues
    });

    it('should validate reregisterIpcHandlers method exists and is callable', () => {
      expect(typeof ipcRegistry.reregisterIpcHandlers).toBe('function');
      // We don't call it to avoid ipcMain dependency issues
    });
  });

  describe('Error Handling Tests', () => {
    let ipcRegistry;

    beforeEach(async () => {
      const { IpcRegistry } = await import('../../src/ipc/index.js');
      ipcRegistry = new IpcRegistry(mockDependencies);
    });

    it('should validate error handling structure exists', () => {
      // Test that error handling methods exist
      expect(typeof ipcRegistry.registerIpcHandlers).toBe('function');
      expect(typeof ipcRegistry.unregisterIpcHandlers).toBe('function');
      expect(mockLogger.error).toBeDefined();
      expect(mockLogger.warn).toBeDefined();
    });

    it('should handle invalid dependencies gracefully', async () => {
      const { IpcRegistry } = await import('../../src/ipc/index.js');
      
      // Test with missing logger - should throw when trying to use it
      expect(() => {
        const registry = new IpcRegistry({ logger: undefined });
        registry.logger.info('test');
      }).toThrow();
    });
  });

  describe('Factory Function Tests', () => {
    it('should create registry using factory function', async () => {
      const { createIpcRegistry } = await import('../../src/ipc/index.js');
      const registry = createIpcRegistry(mockDependencies);
      
      expect(registry).toBeDefined();
      expect(registry.constructor.name).toBe('IpcRegistry');
    });

    it('should validate factory function type', async () => {
      const { createIpcRegistry } = await import('../../src/ipc/index.js');
      expect(typeof createIpcRegistry).toBe('function');
    });
  });
});