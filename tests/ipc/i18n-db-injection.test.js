/**
 * @fileoverview Regression tests for i18n database injection (Bug 2 fix)
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function createMockDb(initialLocale = null) {
  let storedLocale = initialLocale;
  return {
    get: vi.fn(async (sql, params) => {
      if (sql.includes('settings') && params[0] === 'locale') {
        return storedLocale ? { value: storedLocale } : null;
      }
      return null;
    }),
    run: vi.fn(async (sql, params) => {
      if (sql.includes('settings') && params[0] === 'locale') {
        storedLocale = params[1];
      }
      return { id: 1, changes: 1 };
    })
  };
}

function createMockDatabaseManager(initialLocale = null) {
  const db = createMockDb(initialLocale);
  return {
    getDatabase: vi.fn().mockResolvedValue(db),
    _db: db
  };
}

describe('i18n database injection (Bug 2 regression)', () => {
  let mockLogger;

  beforeEach(() => {
    vi.clearAllMocks();

    global.mockElectron.app.isPackaged = false;
    global.mockElectron.app.getAppPath = vi.fn(() => '/mock/app/path');

    mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  });

  describe('I18nHandlers constructor', () => {
    it('should accept databaseManager parameter', async () => {
      const { I18nHandlers } = await import('../../src/ipc/i18n.js');
      const databaseManager = createMockDatabaseManager();
      const ipcMain = {
        handle: vi.fn(),
        on: vi.fn(),
        removeHandler: vi.fn(),
        removeAllListeners: vi.fn()
      };

      const handlers = new I18nHandlers({
        logger: mockLogger,
        databaseManager,
        ipcMain
      });

      expect(handlers).toBeDefined();
      expect(handlers.databaseManager).toBe(databaseManager);
    });

    it('should handle missing databaseManager gracefully', async () => {
      const { I18nHandlers } = await import('../../src/ipc/i18n.js');
      const ipcMain = {
        handle: vi.fn(),
        on: vi.fn(),
        removeHandler: vi.fn(),
        removeAllListeners: vi.fn()
      };

      expect(() => {
        new I18nHandlers({
          logger: mockLogger,
          databaseManager: undefined,
          ipcMain
        });
      }).not.toThrow();
    });

    it('should call databaseManager.getDatabase() during construction', async () => {
      const { I18nHandlers } = await import('../../src/ipc/i18n.js');
      const databaseManager = createMockDatabaseManager();
      const ipcMain = {
        handle: vi.fn(),
        on: vi.fn(),
        removeHandler: vi.fn(),
        removeAllListeners: vi.fn()
      };

      new I18nHandlers({
        logger: mockLogger,
        databaseManager,
        ipcMain
      });

      // Allow the async IIFE to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(databaseManager.getDatabase).toHaveBeenCalled();
    });

    it('should warn when databaseManager.getDatabase() fails', async () => {
      const { I18nHandlers } = await import('../../src/ipc/i18n.js');
      const databaseManager = {
        getDatabase: vi.fn().mockRejectedValue(new Error('DB not initialized'))
      };
      const ipcMain = {
        handle: vi.fn(),
        on: vi.fn(),
        removeHandler: vi.fn(),
        removeAllListeners: vi.fn()
      };

      new I18nHandlers({
        logger: mockLogger,
        databaseManager,
        ipcMain
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not load locale'),
        expect.any(String)
      );
    });
  });

  describe('databaseManager.getDatabase() in handler operations', () => {
    let handlers;
    let databaseManager;
    let ipcMain;

    beforeEach(async () => {
      const { I18nHandlers } = await import('../../src/ipc/i18n.js');
      databaseManager = createMockDatabaseManager();
      ipcMain = {
        handle: vi.fn(),
        on: vi.fn(),
        removeHandler: vi.fn(),
        removeAllListeners: vi.fn()
      };

      handlers = new I18nHandlers({
        logger: mockLogger,
        databaseManager,
        ipcMain
      });

      handlers.registerHandlers();
    });

    it('should call databaseManager.getDatabase() for i18n:get-locale', async () => {
      const call = ipcMain.handle.mock.calls.find(
        c => c[0] === 'i18n:get-locale'
      );
      expect(call).toBeDefined();
      const handler = call[1];

      await handler({});

      expect(databaseManager.getDatabase).toHaveBeenCalled();
    });

    it('should call databaseManager.getDatabase() for i18n:set-locale', async () => {
      const call = ipcMain.handle.mock.calls.find(
        c => c[0] === 'i18n:set-locale'
      );
      expect(call).toBeDefined();
      const handler = call[1];

      await handler({}, 'pt-BR');

      expect(databaseManager.getDatabase).toHaveBeenCalled();
      const db = await databaseManager.getDatabase();
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('settings'),
        ['locale', 'pt-BR']
      );
    });

    it('should call databaseManager.getDatabase() for i18n:get-translations without locale', async () => {
      const call = ipcMain.handle.mock.calls.find(
        c => c[0] === 'i18n:get-translations'
      );
      expect(call).toBeDefined();
      const handler = call[1];

      await handler({});

      expect(databaseManager.getDatabase).toHaveBeenCalled();
    });

    it('should not call databaseManager.getDatabase() for i18n:get-available-locales', async () => {
      databaseManager.getDatabase.mockClear();

      const call = ipcMain.handle.mock.calls.find(
        c => c[0] === 'i18n:get-available-locales'
      );
      expect(call).toBeDefined();
      const handler = call[1];

      const result = await handler({});

      expect(databaseManager.getDatabase).not.toHaveBeenCalled();
      expect(result).toEqual(['en', 'pt-BR', 'es']);
    });
  });

  describe('I18nHandlers does NOT accept raw db (old API)', () => {
    it('should not have a db property when passed as db option', async () => {
      const { I18nHandlers } = await import('../../src/ipc/i18n.js');
      const db = createMockDb();
      const ipcMain = {
        handle: vi.fn(),
        on: vi.fn(),
        removeHandler: vi.fn(),
        removeAllListeners: vi.fn()
      };

      const handlers = new I18nHandlers({
        logger: mockLogger,
        db,
        ipcMain
      });

      expect(handlers.databaseManager).toBeUndefined();
      expect(handlers.db).toBeUndefined();
    });
  });
});
