/**
 * @fileoverview Tests for Logger module
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, appLogger } from '../../src/main/logging/logger.js';

// Mock Electron
const mockWindows = [
  {
    isDestroyed: vi.fn(() => false),
    webContents: {
      send: vi.fn()
    }
  },
  {
    isDestroyed: vi.fn(() => true),
    webContents: {
      send: vi.fn()
    }
  }
];

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => mockWindows)
  }
}));

describe('Logger', () => {
  let logger;
  let originalConsole;

  beforeEach(() => {
    // Store original console methods
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    logger = new Logger({
      maxBufferSize: 100,
      enableConsoleOverride: false,
      enableWindowBroadcast: false // Disable for testing to avoid Electron issues
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore console methods
    Object.assign(console, originalConsole);
  });

  describe('constructor', () => {
    it('should create logger with default config', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger.getConfig().maxBufferSize).toBe(10000);
      expect(defaultLogger.getConfig().enableConsoleOverride).toBe(true);
      expect(defaultLogger.getConfig().enableWindowBroadcast).toBe(true);
    });

    it('should create logger with custom config', () => {
      const customLogger = new Logger({
        maxBufferSize: 500,
        enableConsoleOverride: false,
        enableWindowBroadcast: false
      });
      expect(customLogger.getConfig().maxBufferSize).toBe(500);
      expect(customLogger.getConfig().enableConsoleOverride).toBe(false);
      expect(customLogger.getConfig().enableWindowBroadcast).toBe(false);
    });
  });

  describe('addToLog', () => {
    it('should add log entry to buffer', () => {
      logger.addToLog('info', 'Test message');
      const logs = logger.getLogs();
      expect(logs).toContain('[INFO] Test message');
    });

    it('should handle object arguments', () => {
      const obj = { key: 'value' };
      logger.addToLog('info', 'Object:', obj);
      const logs = logger.getLogs();
      expect(logs).toContain('Object: {"key": "value"}');
    });

    it('should broadcast to windows when enabled', () => {
      logger.addToLog('info', 'Broadcast test');
      expect(mockWindows[0].webContents.send).toHaveBeenCalledWith(
        'app-log-output',
        expect.stringContaining('[INFO] Broadcast test')
      );
    });

    it('should not broadcast to destroyed windows', () => {
      logger.addToLog('info', 'Test');
      expect(mockWindows[1].webContents.send).not.toHaveBeenCalled();
    });

    it('should limit buffer size', () => {
      const smallLogger = new Logger({ maxBufferSize: 3 });
      for (let i = 0; i < 5; i++) {
        smallLogger.addToLog('info', `Message ${i}`);
      }
      const logs = smallLogger.getLogs();
      expect(logs.split('\n').filter(line => line.trim()).length).toBe(3);
      expect(logs).toContain('Message 4');
      expect(logs).not.toContain('Message 0');
    });
  });

  describe('console override', () => {
    it('should override console methods when enabled', () => {
      const overrideLogger = new Logger({
        enableConsoleOverride: true,
        enableWindowBroadcast: false
      });
      
      console.log('Test override');
      const logs = overrideLogger.getLogs();
      expect(logs).toContain('[INFO] Test override');
    });

    it('should not override console methods when disabled', () => {
      const noOverrideLogger = new Logger({
        enableConsoleOverride: false,
        enableWindowBroadcast: false
      });
      
      console.log('Test no override');
      const logs = noOverrideLogger.getLogs();
      expect(logs).toBe('');
    });

    it('should restore console methods', () => {
      const overrideLogger = new Logger({ enableConsoleOverride: true });
      overrideLogger.restoreConsoleMethods();
      
      // After restore, console.log should be original
      expect(console.log).toBe(originalConsole.log);
    });
  });

  describe('getLogsByLevel', () => {
    beforeEach(() => {
      logger.addToLog('info', 'Info message');
      logger.addToLog('error', 'Error message');
      logger.addToLog('warn', 'Warning message');
      logger.addToLog('info', 'Another info');
    });

    it('should filter logs by level', () => {
      const errorLogs = logger.getLogsByLevel('error');
      expect(errorLogs).toContain('[ERROR] Error message');
      expect(errorLogs).not.toContain('[INFO] Info message');
    });

    it('should be case insensitive', () => {
      const infoLogs = logger.getLogsByLevel('INFO');
      expect(infoLogs).toContain('[INFO] Info message');
      expect(infoLogs).toContain('[INFO] Another info');
    });
  });

  describe('utility methods', () => {
    it('should clear logs', () => {
      logger.addToLog('info', 'Test message');
      expect(logger.getBufferSize()).toBe(1);
      
      logger.clearLogs();
      expect(logger.getBufferSize()).toBe(0);
      expect(logger.getLogs()).toBe('');
    });

    it('should get buffer size', () => {
      expect(logger.getBufferSize()).toBe(0);
      logger.addToLog('info', 'Test');
      expect(logger.getBufferSize()).toBe(1);
    });

    it('should update config', () => {
      logger.updateConfig({ maxBufferSize: 200 });
      expect(logger.getConfig().maxBufferSize).toBe(200);
      expect(logger.getConfig().enableConsoleOverride).toBe(true); // unchanged
    });
  });

  describe('error handling', () => {
    it('should handle broadcast errors gracefully', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows.mockImplementation(() => {
        throw new Error('Broadcast error');
      });

      // Should not throw
      expect(() => logger.addToLog('info', 'Test')).not.toThrow();
    });
  });
});

describe('appLogger', () => {
  it('should export singleton instance', () => {
    expect(appLogger).toBeInstanceOf(Logger);
  });

  it('should have default configuration', () => {
    const config = appLogger.getConfig();
    expect(config.maxBufferSize).toBe(10000);
    expect(config.enableConsoleOverride).toBe(true);
  });
});