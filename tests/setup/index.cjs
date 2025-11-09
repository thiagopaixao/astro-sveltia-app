const path = require('path');
const { beforeEach, afterEach } = require('node:test');
const { vi } = require('./mini-vi.cjs');
const {
  electronMock,
  fsMock,
  childProcessMock,
  sqlite3Mock,
  keytarMock,
  gitMock,
  gitHttpMock,
  octokitModuleMock,
  rimrafModuleMock,
  resetAllMocks
} = require('./mocks.cjs');

function applyBaseMocks() {
  vi.mock('electron', () => electronMock, { parentModule: module });
  vi.mock('fs', () => fsMock, { parentModule: module });
  vi.mock('child_process', () => childProcessMock, { parentModule: module });
  vi.mock('sqlite3', () => sqlite3Mock, { parentModule: module });
  vi.mock('keytar', () => keytarMock, { parentModule: module });
  vi.mock('isomorphic-git', () => gitMock, { parentModule: module });
  vi.mock('isomorphic-git/http/node', () => gitHttpMock, { parentModule: module });
  vi.mock('@octokit/rest', () => octokitModuleMock, { parentModule: module });
  vi.mock('rimraf', () => rimrafModuleMock, { parentModule: module });
}

applyBaseMocks();

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

  vi.restoreAllMocks();
  applyBaseMocks();
});
