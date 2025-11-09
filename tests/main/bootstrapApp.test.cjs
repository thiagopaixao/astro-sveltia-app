const { describe, it, expect, vi } = require('vitest');
const { bootstrapApp } = require('../../src/main/bootstrap/app');

describe('bootstrapApp', () => {
  it('wires the Electron lifecycle and delegates to the provided callbacks', async () => {
    const app = {
      whenReady: vi.fn(() => Promise.resolve()),
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

    expect(app.whenReady).toHaveBeenCalledTimes(1);

    await Promise.resolve();

    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(initializeDatabase).toHaveBeenCalledTimes(1);
    expect(registerHandlers).toHaveBeenCalledTimes(1);

    expect(app.on).toHaveBeenCalledWith('activate', onActivate);
    expect(app.on).toHaveBeenCalledWith('before-quit', onBeforeQuit);
    expect(app.on).toHaveBeenCalledWith('window-all-closed', onWindowAllClosed);
  });
});
