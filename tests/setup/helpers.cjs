const path = require('path');
const {
  electronMock,
  fsMock,
  childProcessMock,
  createWindowMock
} = require('./mocks.cjs');

function loadMainProcess() {
  const mainPath = path.resolve(__dirname, '../../main.js');
  delete require.cache[mainPath];
  return require(mainPath);
}

function getIpcHandler(channel) {
  const calls = electronMock.ipcMain.handle.mock.calls;
  for (const call of calls) {
    if (call[0] === channel) {
      return call[1];
    }
  }
  return undefined;
}

module.exports = {
  loadMainProcess,
  getIpcHandler,
  electronMock,
  fsMock,
  childProcessMock,
  createWindowMock
};
