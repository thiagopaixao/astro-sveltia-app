// Test setup file for Vitest
// This file runs before each test file

import { vi } from 'vitest';

// Mock Electron APIs
global.mockElectron = {
  app: {
    getPath: vi.fn(),
    getVersion: vi.fn(),
    quit: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn()
  },
  contextBridge: {
    exposeInMainWorld: vi.fn()
  }
};

// Mock Node.js modules
vi.mock('electron', () => global.mockElectron);
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((...args) => args.join('/')),
  dirname: vi.fn(),
  basename: vi.fn()
}));

vi.mock('sqlite3', () => ({
  verbose: vi.fn(() => ({
    Database: vi.fn()
  }))
}));

// Global test utilities
global.createMockWindow = () => ({
  webContents: {
    send: vi.fn()
  },
  isDestroyed: vi.fn(() => false)
});

global.createMockProcess = () => ({
  kill: vi.fn(),
  on: vi.fn(),
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() }
});