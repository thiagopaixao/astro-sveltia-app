const path = require('path');
const { beforeEach, afterEach, vi } = require('vitest');
const { electronMock, fsMock, childProcessMock, resetAllMocks } = require('./mocks.cjs');

vi.mock('electron', () => electronMock);
vi.mock('fs', () => fsMock);
vi.mock('child_process', () => childProcessMock);

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

beforeEach(() => {
  resetAllMocks();
});

afterEach(() => {
  const mainPath = path.resolve(__dirname, '../../main.js');
  delete require.cache[mainPath];

  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
});
