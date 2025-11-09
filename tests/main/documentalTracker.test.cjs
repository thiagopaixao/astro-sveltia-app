const { describe, it, expect, beforeEach, vi } = require('vitest');
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

    expect(processes).toEqual(storedProcesses);
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

    expect(fsMock.writeFileSync).toHaveBeenCalledTimes(1);

    const addedProcess = tracker.getProcess(20);
    expect(addedProcess).toMatchObject({ pid: 20, projectId: 'alpha', command: 'npm run dev' });

    tracker.updateProcess(20, { port: 4321 });
    const updatedProcess = tracker.getProcess(20);
    expect(updatedProcess.port).toBe(4321);

    tracker.removeProcess(20);
    expect(tracker.getProcess(20)).toBeUndefined();
    expect(fsMock.writeFileSync).toHaveBeenCalledTimes(3);
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
    expect(original.projectId).toBe('beta');
  });
});
