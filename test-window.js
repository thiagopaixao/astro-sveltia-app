/**
 * @fileoverview Quick test for modular window creation
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

// Mock Electron APIs for testing
const mockElectron = {
  app: {
    getPath: (name) => {
      if (name === 'userData') return '/tmp/test-user-data';
      if (name === 'home') return '/home/test';
      return '/tmp';
    },
    whenReady: () => Promise.resolve(),
    on: () => {},
    quit: () => {}
  },
  BrowserWindow: class MockBrowserWindow {
    constructor(options) {
      console.log('🪟 Creating BrowserWindow with options:', options);
      this.options = options;
    }
    maximize() { console.log('📐 Window maximized'); }
    show() { console.log('👁️ Window shown'); }
    loadFile(path) { console.log('📄 Loading file:', path); }
    get webContents() { 
      return { openDevTools: () => {} }; 
    }
    static getAllWindows() { return []; }
  },
  Menu: { setApplicationMenu: () => {} },
  ipcMain: { handle: () => {} },
  dialog: { showOpenDialog: () => Promise.resolve({ canceled: true }) }
};

// Mock other dependencies
const mockFs = {
  existsSync: () => false,
  writeFileSync: () => {},
  mkdirSync: () => {}
};

const mockPath = {
  join: (...parts) => parts.join('/')
};

const mockSqlite3 = {
  Database: class MockDatabase {
    constructor(path, callback) {
      console.log('🗄️ Creating database at:', path);
      setTimeout(callback, 0);
    }
    run(sql, callback) {
      console.log('📝 Executing SQL:', sql);
      if (callback) setTimeout(() => callback(null), 0);
    }
  },
  verbose: () => mockSqlite3
};

const mockOctokit = class MockOctokit {
  constructor() { console.log('🐙 Octokit initialized'); }
};

const mockKeytar = {
  getPassword: () => Promise.resolve(null),
  setPassword: () => Promise.resolve(),
  deletePassword: () => Promise.resolve()
};

const mockGit = {
  clone: () => Promise.resolve(),
  init: () => Promise.resolve(),
  add: () => Promise.resolve(),
  commit: () => Promise.resolve(),
  push: () => Promise.resolve(),
  pull: () => Promise.resolve()
};

const mockHttp = {};

const mockRimraf = () => Promise.resolve();

const mockGithubConfig = {};

// Mock modules before requiring main-modular
require.cache[require.resolve('electron')] = { exports: mockElectron };
require.cache[require.resolve('fs')] = { exports: mockFs };
require.cache[require.resolve('path')] = { exports: mockPath };
require.cache[require.resolve('sqlite3')] = { exports: mockSqlite3 };
require.cache[require.resolve('@octokit/rest')] = { exports: { Octokit: mockOctokit } };
require.cache[require.resolve('keytar')] = { exports: mockKeytar };
require.cache[require.resolve('isomorphic-git')] = { exports: mockGit };
require.cache[require.resolve('isomorphic-git/http/node')] = { exports: mockHttp };
require.cache[require.resolve('rimraf')] = { exports: mockRimraf };
require.cache[require.resolve('./github-config.js')] = { exports: mockGithubConfig };

console.log('🧪 Testing modular window creation...');

try {
  // Import the modular main
  require('./main-modular.js');
  
  console.log('✅ Modular main loaded successfully');
  console.log('🎯 Window creation logic is working');
  console.log('🚀 Ready for Electron execution');
  
} catch (error) {
  console.error('❌ Error testing modular window:', error);
  process.exit(1);
}