const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { vi } = require('../setup/mini-vi.cjs');
require('../setup/index.cjs');
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

    assert.ok(logs.includes('logger-info'));
    assert.ok(logs.includes('logger-error'));
  });

  it('enforces the maximum buffer size by trimming older entries', () => {
    logger = createLogger({ BrowserWindow, maxBufferSize: 5 });

    for (let index = 0; index < 10; index += 1) {
      console.log(`entry-${index}`);
    }

    const snapshot = logger.getLogBufferSnapshot();

    assert.strictEqual(snapshot.length, 5);
    assert.ok(snapshot[0].includes('entry-5'));
    assert.ok(snapshot[4].includes('entry-9'));
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

    const [channelA, payloadA] = windowA.webContents.send.mock.calls[0];
    assert.strictEqual(channelA, 'app-log-output');
    assert.match(payloadA, /broadcast-entry/);

    const [channelB, payloadB] = windowB.webContents.send.mock.calls[0];
    assert.strictEqual(channelB, 'app-log-output');
    assert.match(payloadB, /broadcast-entry/);
  });

  it('uses the default buffer size when none is provided', () => {
    logger = createLogger({ BrowserWindow });

    assert.strictEqual(logger.maxBufferSize, DEFAULT_MAX_LOG_BUFFER_SIZE);
  });
});
