const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { vi } = require('../setup/mini-vi.cjs');
require('../setup/index.cjs');
const { createDocumentalTracker } = require('../../src/main/processes/documentalTracker');

describe('createDocumentalTracker', () => {
  let fsMock;
  let pathMock;
  beforeEach(() => {
    fsMock = {
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => ''),
      writeFileSync: vi.fn()
    };
    pathMock = {
      join: (...parts) => parts.join('/')
    };
  });

  it('loads processes from disk when the persistence file exists', () => {
    const storedProcesses = {
      10: { pid: 10, port: 3333 }
    };

    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue(JSON.stringify(storedProcesses));

    const tracker = createDocumentalTracker({
      fs: fsMock,
      path: pathMock,
      processesFilePath: '/tmp/documental.json'
    });

    const processes = tracker.loadProcesses();

    assert.deepStrictEqual(processes, storedProcesses);
  });

  it('adds, updates and removes processes while persisting data to disk', () => {
    const tracker = createDocumentalTracker({
      fs: fsMock,
      path: pathMock,
      processesFilePath: '/tmp/documental.json'
    });

    tracker.addProcess(20, {
      port: null,
      projectId: 'alpha',
      command: 'npm run dev',
      cwd: '/projects/alpha'
    });

    assert.strictEqual(fsMock.writeFileSync.mock.calls.length, 1);

    const addedProcess = tracker.getProcess(20);
    assert.deepStrictEqual(
      { pid: addedProcess.pid, projectId: addedProcess.projectId, command: addedProcess.command },
      { pid: 20, projectId: 'alpha', command: 'npm run dev' }
    );

    tracker.updateProcess(20, { port: 4321 });
    const updatedProcess = tracker.getProcess(20);
    assert.strictEqual(updatedProcess.port, 4321);

    tracker.removeProcess(20);
    assert.strictEqual(tracker.getProcess(20), undefined);
    assert.strictEqual(fsMock.writeFileSync.mock.calls.length, 3);
  });

  it('returns snapshots without exposing internal references', () => {
    const tracker = createDocumentalTracker({
      fs: fsMock,
      path: pathMock,
      processesFilePath: '/tmp/documental.json'
    });

    tracker.addProcess(30, {
      port: 5555,
      projectId: 'beta',
      command: 'npm run dev',
      cwd: '/projects/beta'
    });

    const snapshot = tracker.getProcessesSnapshot();
    snapshot[30].projectId = 'mutated';

    const original = tracker.getProcess(30);
    assert.strictEqual(original.projectId, 'beta');
  });
});
