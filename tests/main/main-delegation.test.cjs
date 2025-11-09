const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { vi } = require('../setup/mini-vi.cjs');
require('../setup/index.cjs');

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

vi.mock('../../src/main/logging/logger', () => ({ createLogger: createLoggerMock }), { parentModule: module });
vi.mock(
  '../../src/main/processes/documentalTracker',
  () => ({ createDocumentalTracker: createDocumentalTrackerMock }),
  { parentModule: module }
);
vi.mock('../../src/main/bootstrap/app', () => ({ bootstrapApp: bootstrapAppMock }), { parentModule: module });

const { loadMainProcess, electronMock, fsMock } = require('../setup/helpers.cjs');

describe('main process delegation', () => {
  it('delegates startup responsibilities to dedicated modules', () => {
    loadMainProcess();

    assert.deepStrictEqual(createLoggerMock.mock.calls[0][0], { BrowserWindow: electronMock.BrowserWindow });

    const trackerArgs = createDocumentalTrackerMock.mock.calls[0][0];
    assert.strictEqual(trackerArgs.fs, fsMock);
    assert.ok(typeof trackerArgs.path === 'object');
    assert.ok(typeof trackerArgs.path.join === 'function');
    assert.ok(typeof trackerArgs.processesFilePath === 'string');

    assert.strictEqual(bootstrapAppMock.mock.calls.length, 1);

    const bootstrapArgs = bootstrapAppMock.mock.calls[0][0];

    assert.strictEqual(typeof bootstrapArgs.registerHandlers, 'function');
    assert.strictEqual(typeof bootstrapArgs.onActivate, 'function');
    assert.strictEqual(typeof bootstrapArgs.onBeforeQuit, 'function');
    assert.strictEqual(typeof bootstrapArgs.onWindowAllClosed, 'function');

    bootstrapArgs.registerHandlers();

    const homeHandlerCall = electronMock.ipcMain.handle.mock.calls.find(([channel]) => channel === 'get-home-directory');
    assert.ok(homeHandlerCall);
    assert.strictEqual(typeof homeHandlerCall[1], 'function');

    const logsHandlerCall = electronMock.ipcMain.handle.mock.calls.find(([channel]) => channel === 'get-app-logs');
    assert.ok(logsHandlerCall);
    assert.strictEqual(typeof logsHandlerCall[1], 'function');
  });
});
