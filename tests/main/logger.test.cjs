const { describe, it, expect } = require('vitest');
const {
  loadMainProcess,
  getIpcHandler,
  electronMock,
  createWindowMock
} = require('../setup/helpers.cjs');

describe('main process logger', () => {
  it('buffers log entries and exposes them through the get-app-logs handler', async () => {
    loadMainProcess();

    const getLogsHandler = getIpcHandler('get-app-logs');
    expect(getLogsHandler).toBeTypeOf('function');

    console.log('first message');
    console.error('second message');

    const logs = await getLogsHandler();

    expect(logs).toContain('first message');
    expect(logs).toContain('second message');
  });

  it('keeps only the most recent messages within the buffer limit', async () => {
    loadMainProcess();

    const getLogsHandler = getIpcHandler('get-app-logs');
    expect(getLogsHandler).toBeTypeOf('function');

    const totalEntries = 10005;
    for (let index = 0; index < totalEntries; index += 1) {
      console.log(`buffer-entry-${index}`);
    }

    const logs = await getLogsHandler();
    const entries = logs.trim().split('\n');

    expect(entries.length).toBeLessThanOrEqual(10000);
    expect(entries[0]).toContain('buffer-entry-5');
    expect(entries[entries.length - 1]).toContain('buffer-entry-10004');
  });

  it('broadcasts each log entry to every available BrowserWindow', () => {
    loadMainProcess();

    const windowA = createWindowMock();
    const windowB = createWindowMock();

    electronMock.BrowserWindow.getAllWindows.mockReturnValue([windowA, windowB]);

    console.log('broadcast-test');

    expect(windowA.webContents.send).toHaveBeenCalledWith(
      'app-log-output',
      expect.stringContaining('broadcast-test')
    );
    expect(windowB.webContents.send).toHaveBeenCalledWith(
      'app-log-output',
      expect.stringContaining('broadcast-test')
    );
  });
});
