const DEFAULT_MAX_LOG_BUFFER_SIZE = 10000;

function createLogger({ BrowserWindow, maxBufferSize = DEFAULT_MAX_LOG_BUFFER_SIZE } = {}) {
  if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== 'function') {
    throw new Error('BrowserWindow with getAllWindows method is required');
  }

  let appLogBuffer = [];

  const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console)
  };

  function broadcastLogEntry(entry) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (window && typeof window.isDestroyed === 'function' && !window.isDestroyed()) {
        const { webContents } = window;
        if (webContents && typeof webContents.send === 'function') {
          webContents.send('app-log-output', entry);
        }
      }
    });
  }

  function formatLogEntry(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  }

  function addToAppLog(level, ...args) {
    const entry = formatLogEntry(level, args);

    appLogBuffer.push(entry);
    if (appLogBuffer.length > maxBufferSize) {
      appLogBuffer = appLogBuffer.slice(-maxBufferSize);
    }

    broadcastLogEntry(entry);
  }

  function overrideConsole(methodName, level) {
    console[methodName] = (...args) => {
      addToAppLog(level, ...args);
      originalConsole[methodName](...args);
    };
  }

  overrideConsole('log', 'info');
  overrideConsole('error', 'error');
  overrideConsole('warn', 'warn');
  overrideConsole('info', 'info');

  function getAppLogs() {
    return appLogBuffer.join('');
  }

  function restoreConsole() {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  }

  function getLogBufferSnapshot() {
    return [...appLogBuffer];
  }

  return {
    addToAppLog,
    getAppLogs,
    restoreConsole,
    getLogBufferSnapshot,
    maxBufferSize
  };
}

module.exports = {
  createLogger,
  DEFAULT_MAX_LOG_BUFFER_SIZE
};
