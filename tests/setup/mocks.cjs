const { vi } = require('vitest');
const actualFs = require('fs');

const resetters = [];

function createMockFn(defaultImpl) {
  const fn = defaultImpl ? vi.fn(defaultImpl) : vi.fn();
  resetters.push(() => {
    fn.mockReset();
    if (defaultImpl) {
      fn.mockImplementation(defaultImpl);
    }
  });
  return fn;
}

function createStreamMock() {
  return {
    on: createMockFn(),
    once: createMockFn(),
    emit: createMockFn(),
    end: createMockFn(),
    destroy: createMockFn(),
    close: createMockFn(),
    pipe: createMockFn()
  };
}

function createElectronMock() {
  const browserWindowConstructor = createMockFn(() => {
    return {
      loadURL: createMockFn(),
      loadFile: createMockFn(),
      on: createMockFn(),
      once: createMockFn(),
      show: createMockFn(),
      hide: createMockFn(),
      close: createMockFn(),
      focus: createMockFn(),
      setBrowserView: createMockFn(),
      removeBrowserView: createMockFn(),
      setBounds: createMockFn(),
      setMenuBarVisibility: createMockFn(),
      webContents: {
        send: createMockFn(),
        on: createMockFn(),
        once: createMockFn(),
        openDevTools: createMockFn(),
        close: createMockFn()
      },
      isDestroyed: createMockFn(() => false)
    };
  });

  browserWindowConstructor.getAllWindows = createMockFn(() => []);
  browserWindowConstructor.fromWebContents = createMockFn(() => null);

  return {
    app: {
      getPath: createMockFn(() => '/tmp/documental'),
      on: createMockFn(),
      once: createMockFn(),
      whenReady: createMockFn(() => Promise.resolve()),
      isReady: createMockFn(() => false),
      quit: createMockFn(),
      removeListener: createMockFn(),
      removeAllListeners: createMockFn()
    },
    BrowserWindow: browserWindowConstructor,
    BrowserView: createMockFn(() => ({
      setBounds: createMockFn(),
      setAutoResize: createMockFn(),
      webContents: {
        loadURL: createMockFn(),
        on: createMockFn(),
        once: createMockFn(),
        send: createMockFn(),
        openDevTools: createMockFn(),
        close: createMockFn()
      }
    })),
    ipcMain: {
      handle: createMockFn(),
      handleOnce: createMockFn(),
      on: createMockFn(),
      once: createMockFn(),
      removeHandler: createMockFn(),
      removeListener: createMockFn(),
      removeAllListeners: createMockFn()
    },
    Menu: {
      setApplicationMenu: createMockFn(),
      buildFromTemplate: createMockFn()
    },
    dialog: {
      showOpenDialog: createMockFn(async () => ({ canceled: true, filePaths: [] })),
      showMessageBox: createMockFn(async () => ({ response: 0 })),
      showErrorBox: createMockFn()
    },
    shell: {
      openExternal: createMockFn(),
      openPath: createMockFn()
    }
  };
}

function createFsMock() {
  const stubs = {
    existsSync: createMockFn(() => false),
    readFileSync: createMockFn(() => ''),
    writeFileSync: createMockFn(),
    mkdirSync: createMockFn(),
    rmSync: createMockFn(),
    readdirSync: createMockFn(() => []),
    statSync: createMockFn(() => ({
      isDirectory: () => false,
      isFile: () => true
    })),
    readlinkSync: createMockFn(() => ''),
    createWriteStream: createMockFn(() => createStreamMock()),
    createReadStream: createMockFn(() => createStreamMock()),
    renameSync: createMockFn(),
    copyFileSync: createMockFn()
  };

  return new Proxy({}, {
    get(_, prop) {
      if (prop in stubs) {
        return stubs[prop];
      }
      return actualFs[prop];
    }
  });
}

function createChildProcessMock() {
  return {
    spawn: createMockFn(() => ({
      stdout: {
        on: createMockFn()
      },
      stderr: {
        on: createMockFn()
      },
      on: createMockFn()
    })),
    execSync: createMockFn(() => '')
  };
}

function createWindowMock() {
  return {
    isDestroyed: createMockFn(() => false),
    webContents: {
      send: createMockFn(),
      on: createMockFn(),
      once: createMockFn(),
      openDevTools: createMockFn(),
      close: createMockFn()
    }
  };
}

function resetAllMocks() {
  vi.clearAllMocks();
  resetters.forEach(reset => reset());
}

const electronMock = createElectronMock();
const fsMock = createFsMock();
const childProcessMock = createChildProcessMock();

module.exports = {
  electronMock,
  fsMock,
  childProcessMock,
  createWindowMock,
  resetAllMocks
};
