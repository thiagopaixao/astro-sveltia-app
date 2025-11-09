const { describe, it, expect, beforeEach, afterEach, vi } = require('vitest');
const { createLogger, DEFAULT_MAX_LOG_BUFFER_SIZE } = require('../../src/main/logging/logger');

describe('createLogger', () => {
  let logger;
  let BrowserWindow;

  beforeEach(() => {
    BrowserWindow = {
      getAllWindows: vi.fn(() => [])
    };
  });

  afterEach(() => {
    if (logger) {
      logger.restoreConsole();
      logger = undefined;
    }
  });

  it('captures console output and exposes it through getAppLogs', () => {
    logger = createLogger({ BrowserWindow });

    console.log('logger-info');
    console.error('logger-error');

    const logs = logger.getAppLogs();

    expect(logs).toContain('logger-info');
    expect(logs).toContain('logger-error');
  });

  it('enforces the maximum buffer size by trimming older entries', () => {
    logger = createLogger({ BrowserWindow, maxBufferSize: 5 });

    for (let index = 0; index < 10; index += 1) {
      console.log(`entry-${index}`);
    }

    const snapshot = logger.getLogBufferSnapshot();

    expect(snapshot).toHaveLength(5);
    expect(snapshot[0]).toContain('entry-5');
    expect(snapshot[4]).toContain('entry-9');
  });

  it('broadcasts log entries to all BrowserWindow instances', () => {
    const windowA = {
      isDestroyed: vi.fn(() => false),
      webContents: { send: vi.fn() }
    };
    const windowB = {
      isDestroyed: vi.fn(() => false),
      webContents: { send: vi.fn() }
    };

    BrowserWindow.getAllWindows.mockReturnValue([windowA, windowB]);

    logger = createLogger({ BrowserWindow });

    console.warn('broadcast-entry');

    expect(windowA.webContents.send).toHaveBeenCalledWith(
      'app-log-output',
      expect.stringContaining('broadcast-entry')
    );
    expect(windowB.webContents.send).toHaveBeenCalledWith(
      'app-log-output',
      expect.stringContaining('broadcast-entry')
    );
  });

  it('uses the default buffer size when none is provided', () => {
    logger = createLogger({ BrowserWindow });

    expect(logger.maxBufferSize).toBe(DEFAULT_MAX_LOG_BUFFER_SIZE);
  });
});
