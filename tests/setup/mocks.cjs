const { vi } = require('./mini-vi.cjs');
const actualFs = require('fs');

const resetters = [];

function createTrackedMock(defaultImpl) {
  const fn = defaultImpl ? vi.fn(defaultImpl) : vi.fn();
  resetters.push(() => {
    if (typeof fn.mockReset === 'function') {
      fn.mockReset();
    } else if (typeof fn.mockClear === 'function') {
      fn.mockClear();
    }
    if (defaultImpl) {
      fn.mockImplementation(defaultImpl);
    }
  });
  return fn;
}

function createStreamMock() {
  return {
    on: createTrackedMock(),
    once: createTrackedMock(),
    emit: createTrackedMock(),
    end: createTrackedMock(),
    destroy: createTrackedMock(),
    close: createTrackedMock(),
    pipe: createTrackedMock()
  };
}

function createElectronMock() {
  const browserWindowConstructor = createTrackedMock(() => {
    return {
      loadURL: createTrackedMock(),
      loadFile: createTrackedMock(),
      on: createTrackedMock(),
      once: createTrackedMock(),
      show: createTrackedMock(),
      hide: createTrackedMock(),
      close: createTrackedMock(),
      focus: createTrackedMock(),
      setBrowserView: createTrackedMock(),
      removeBrowserView: createTrackedMock(),
      setBounds: createTrackedMock(),
      setMenuBarVisibility: createTrackedMock(),
      webContents: {
        send: createTrackedMock(),
        on: createTrackedMock(),
        once: createTrackedMock(),
        openDevTools: createTrackedMock(),
        close: createTrackedMock()
      },
      isDestroyed: createTrackedMock(() => false)
    };
  });

  browserWindowConstructor.getAllWindows = createTrackedMock(() => []);
  browserWindowConstructor.fromWebContents = createTrackedMock(() => null);

  return {
    app: {
      getPath: createTrackedMock(() => '/tmp/documental'),
      on: createTrackedMock(),
      once: createTrackedMock(),
      whenReady: createTrackedMock(() => Promise.resolve()),
      isReady: createTrackedMock(() => false),
      quit: createTrackedMock(),
      removeListener: createTrackedMock(),
      removeAllListeners: createTrackedMock()
    },
    BrowserWindow: browserWindowConstructor,
    BrowserView: createTrackedMock(() => ({
      setBounds: createTrackedMock(),
      setAutoResize: createTrackedMock(),
      webContents: {
        loadURL: createTrackedMock(),
        on: createTrackedMock(),
        once: createTrackedMock(),
        send: createTrackedMock(),
        openDevTools: createTrackedMock(),
        close: createTrackedMock()
      }
    })),
    ipcMain: {
      handle: createTrackedMock(),
      handleOnce: createTrackedMock(),
      on: createTrackedMock(),
      once: createTrackedMock(),
      removeHandler: createTrackedMock(),
      removeListener: createTrackedMock(),
      removeAllListeners: createTrackedMock()
    },
    Menu: {
      setApplicationMenu: createTrackedMock(),
      buildFromTemplate: createTrackedMock()
    },
    dialog: {
      showOpenDialog: createTrackedMock(async () => ({ canceled: true, filePaths: [] })),
      showMessageBox: createTrackedMock(async () => ({ response: 0 })),
      showErrorBox: createTrackedMock()
    },
    shell: {
      openExternal: createTrackedMock(),
      openPath: createTrackedMock()
    }
  };
}

function createFsMock() {
  const stubs = {
    existsSync: createTrackedMock(() => false),
    readFileSync: createTrackedMock(() => ''),
    writeFileSync: createTrackedMock(),
    mkdirSync: createTrackedMock(),
    rmSync: createTrackedMock(),
    readdirSync: createTrackedMock(() => []),
    statSync: createTrackedMock(() => ({
      isDirectory: () => false,
      isFile: () => true
    })),
    readlinkSync: createTrackedMock(() => ''),
    createWriteStream: createTrackedMock(() => createStreamMock()),
    createReadStream: createTrackedMock(() => createStreamMock()),
    renameSync: createTrackedMock(),
    copyFileSync: createTrackedMock()
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
    spawn: createTrackedMock(() => ({
      stdout: {
        on: createTrackedMock()
      },
      stderr: {
        on: createTrackedMock()
      },
      on: createTrackedMock()
    })),
    execSync: createTrackedMock(() => '')
  };
}

function createWindowMock() {
  return {
    isDestroyed: createTrackedMock(() => false),
    webContents: {
      send: createTrackedMock(),
      on: createTrackedMock(),
      once: createTrackedMock(),
      openDevTools: createTrackedMock(),
      close: createTrackedMock()
    }
  };
}

function createDatabaseMock() {
  return {
    serialize: createTrackedMock((callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    }),
    run: createTrackedMock((_, __, callback) => {
      if (typeof callback === 'function') {
        callback(null);
      }
    }),
    all: createTrackedMock((_, __, callback) => {
      if (typeof callback === 'function') {
        callback(null, []);
      }
    }),
    close: createTrackedMock()
  };
}

const sqlite3Mock = {
  verbose: () => ({
    Database: function Database() {
      return createDatabaseMock();
    }
  })
};

const keytarMock = {
  getPassword: createTrackedMock(async () => null),
  setPassword: createTrackedMock(async () => undefined)
};

const gitMethodMocks = new Map();
const gitMock = new Proxy({}, {
  get(_, prop) {
    if (!gitMethodMocks.has(prop)) {
      const fn = createTrackedMock(async () => undefined);
      gitMethodMocks.set(prop, fn);
    }
    return gitMethodMocks.get(prop);
  }
});

const gitHttpMock = {};

class OctokitMock {
  constructor() {
    this.rest = {
      users: {
        getAuthenticated: createTrackedMock(async () => ({ data: { login: 'mock-user' } }))
      }
    };
  }
}

const octokitModuleMock = { Octokit: OctokitMock };

const rimrafModuleMock = {
  rimraf: createTrackedMock(async () => undefined)
};

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
  sqlite3Mock,
  keytarMock,
  gitMock,
  gitHttpMock,
  octokitModuleMock,
  rimrafModuleMock,
  resetAllMocks
};
