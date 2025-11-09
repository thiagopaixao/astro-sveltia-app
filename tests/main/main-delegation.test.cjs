const { describe, it, expect, vi } = require('vitest');

const createLoggerMock = vi.fn(() => ({ getAppLogs: vi.fn() }));
const createDocumentalTrackerMock = vi.fn(() => ({
  addProcess: vi.fn(),
  removeProcess: vi.fn(),
  updateProcess: vi.fn(),
  hasProcess: vi.fn(() => false),
  loadProcesses: vi.fn(),
  getProcessList: vi.fn(() => [])
}));
const bootstrapAppMock = vi.fn();

vi.mock('../../src/main/logging/logger', () => ({ createLogger: createLoggerMock }));
vi.mock('../../src/main/processes/documentalTracker', () => ({ createDocumentalTracker: createDocumentalTrackerMock }));
vi.mock('../../src/main/bootstrap/app', () => ({ bootstrapApp: bootstrapAppMock }));

const { loadMainProcess, electronMock } = require('../setup/helpers.cjs');

describe('main process delegation', () => {
  it('delegates startup responsibilities to dedicated modules', () => {
    loadMainProcess();

    expect(createLoggerMock).toHaveBeenCalledWith({ BrowserWindow: electronMock.BrowserWindow });
    expect(createDocumentalTrackerMock).toHaveBeenCalledWith(expect.objectContaining({
      fs: expect.any(Object),
      path: expect.any(Object),
      processesFilePath: expect.any(String)
    }));
    expect(bootstrapAppMock).toHaveBeenCalledTimes(1);

    const bootstrapArgs = bootstrapAppMock.mock.calls[0][0];

    expect(typeof bootstrapArgs.registerHandlers).toBe('function');
    expect(typeof bootstrapArgs.onActivate).toBe('function');
    expect(typeof bootstrapArgs.onBeforeQuit).toBe('function');
    expect(typeof bootstrapArgs.onWindowAllClosed).toBe('function');

    bootstrapArgs.registerHandlers();

    expect(electronMock.ipcMain.handle).toHaveBeenCalledWith('get-home-directory', expect.any(Function));
    expect(electronMock.ipcMain.handle).toHaveBeenCalledWith('get-app-logs', expect.any(Function));
  });
});
