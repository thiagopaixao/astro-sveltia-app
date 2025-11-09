const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { vi } = require('../setup/mini-vi.cjs');
require('../setup/index.cjs');
const { bootstrapApp } = require('../../src/main/bootstrap/app');

describe('bootstrapApp', () => {
  it('wires the Electron lifecycle and delegates to the provided callbacks', async () => {
    let resolveReady;
    const readyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });
    const app = {
      whenReady: vi.fn(() => readyPromise),
      on: vi.fn()
    };
    const createWindow = vi.fn();
    const initializeDatabase = vi.fn();
    const registerHandlers = vi.fn();
    const onActivate = vi.fn();
    const onBeforeQuit = vi.fn();
    const onWindowAllClosed = vi.fn();

    bootstrapApp({
      app,
      createWindow,
      initializeDatabase,
      registerHandlers,
      onActivate,
      onBeforeQuit,
      onWindowAllClosed
    });

    resolveReady();
    await readyPromise;
    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(createWindow.mock.calls.length, 1);
    assert.strictEqual(initializeDatabase.mock.calls.length, 1);
    assert.strictEqual(registerHandlers.mock.calls.length, 1);

    assert.deepStrictEqual(app.on.mock.calls, [
      ['activate', onActivate],
      ['before-quit', onBeforeQuit],
      ['window-all-closed', onWindowAllClosed]
    ]);
  });
});
