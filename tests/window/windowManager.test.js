/**
 * @fileoverview Tests for window manager module
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Electron dependencies
const mockBrowserWindow = {
  getAllWindows: vi.fn(() => []),
  maximize: vi.fn(),
  show: vi.fn(),
  loadFile: vi.fn(),
  close: vi.fn(),
  focus: vi.fn(),
  minimize: vi.fn(),
  isMaximized: vi.fn(() => false),
  unmaximize: vi.fn(),
  isDestroyed: vi.fn(() => false),
  webContents: {
    send: vi.fn()
  }
};

const mockMenu = {
  setApplicationMenu: vi.fn()
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindow),
  Menu: mockMenu
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn()
}));

const { BrowserWindow } = await import('electron');
const mockFs = await import('fs');

// Import module under test
const { WindowManager } = await import('../../src/main/window/windowManager.js');

describe('WindowManager', () => {
  let windowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    windowManager = new WindowManager({
      basePath: '/test/base',
      userDataPath: '/test/user/data',
      windowConfig: {
        width: 800,
        height: 600
      }
    });
  });

  afterEach(() => {
    windowManager = null;
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const manager = new WindowManager();
      expect(manager.config.windowConfig.width).toBe(900);
      expect(manager.config.windowConfig.height).toBe(600);
      expect(manager.config.windowConfig.show).toBe(false);
      expect(manager.config.windowConfig.maximize).toBe(true);
    });

    it('should create instance with custom config', () => {
      const customConfig = {
        basePath: '/custom/base',
        userDataPath: '/custom/user/data',
        windowConfig: {
          width: 1024,
          height: 768,
          show: true,
          maximize: false
        }
      };
      const manager = new WindowManager(customConfig);
      
      expect(manager.config.basePath).toBe('/custom/base');
      expect(manager.config.userDataPath).toBe('/custom/user/data');
      expect(manager.config.windowConfig.width).toBe(1024);
      expect(manager.config.windowConfig.height).toBe(768);
      expect(manager.config.windowConfig.show).toBe(true);
      expect(manager.config.windowConfig.maximize).toBe(false);
    });
  });

  describe('createMainWindow', () => {
    it('should create main window for first time user', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const window = await windowManager.createMainWindow();
      
      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          preload: expect.stringContaining('preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      expect(mockBrowserWindow.maximize).toHaveBeenCalled();
      expect(mockBrowserWindow.show).toHaveBeenCalled();
      expect(mockBrowserWindow.loadFile).toHaveBeenCalledWith('/test/base/renderer/welcome.html');
      expect(mockMenu.setApplicationMenu).toHaveBeenCalledWith(null);
      expect(window).toBe(mockBrowserWindow);
    });

    it('should create main window for returning user', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      await windowManager.createMainWindow();
      
      expect(mockBrowserWindow.loadFile).toHaveBeenCalledWith('/test/base/renderer/index.html');
    });

    it('should handle missing userDataPath gracefully', async () => {
      const manager = new WindowManager({ basePath: '/test' });
      
      const isFirstTime = await manager.checkFirstTimeUser();
      
      expect(isFirstTime).toBe(false);
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe('checkFirstTimeUser', () => {
    it('should return true for first time user', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const isFirstTime = await windowManager.checkFirstTimeUser();
      
      expect(isFirstTime).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/user/data/.first-time');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('/test/user/data/.first-time', 'true');
    });

    it('should return false for returning user', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const isFirstTime = await windowManager.checkFirstTimeUser();
      
      expect(isFirstTime).toBe(false);
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('getMainWindow', () => {
    it('should return null when no window created', () => {
      expect(windowManager.getMainWindow()).toBeNull();
    });

    it('should return main window when created', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      
      expect(windowManager.getMainWindow()).toBe(mockBrowserWindow);
    });
  });

  describe('hasValidMainWindow', () => {
    it('should return false when no window', () => {
      expect(windowManager.hasValidMainWindow()).toBe(false);
    });

    it('should return true for valid window', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      
      expect(windowManager.hasValidMainWindow()).toBe(true);
    });

    it('should return false for destroyed window', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      mockBrowserWindow.isDestroyed.mockReturnValue(true);
      
      expect(windowManager.hasValidMainWindow()).toBe(false);
    });
  });

  describe('closeMainWindow', () => {
    it('should close valid main window', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      
      windowManager.closeMainWindow();
      
      expect(mockBrowserWindow.close).toHaveBeenCalled();
      expect(windowManager.getMainWindow()).toBeNull();
    });

    it('should handle no main window gracefully', () => {
      expect(() => windowManager.closeMainWindow()).not.toThrow();
    });

    it('should handle destroyed window gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      mockBrowserWindow.isDestroyed.mockReturnValue(true);
      
      expect(() => windowManager.closeMainWindow()).not.toThrow();
    });
  });

  describe('createCustomWindow', () => {
    it('should create custom window with config', () => {
      const customConfig = {
        width: 600,
        height: 400,
        show: false,
        maximize: false
      };
      
      const window = windowManager.createCustomWindow(customConfig);
      
      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 600,
        height: 400,
        show: false,
        maximize: false,
        webPreferences: {
          preload: expect.stringContaining('preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      expect(window).toBe(mockBrowserWindow);
    });

    it('should merge webPreferences correctly', () => {
      const customConfig = {
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      };
      
      windowManager.createCustomWindow(customConfig);
      
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          webPreferences: {
            preload: expect.stringContaining('preload.js'),
            nodeIntegration: true,
            contextIsolation: false
          }
        })
      );
    });
  });

  describe('getAllWindows', () => {
    it('should return all windows', () => {
      const windows = [{}, {}];
      mockBrowserWindow.getAllWindows.mockReturnValue(windows);
      
      expect(windowManager.getAllWindows()).toBe(windows);
      expect(mockBrowserWindow.getAllWindows).toHaveBeenCalled();
    });
  });

  describe('sendToMainWindow', () => {
    it('should send message to valid main window', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      
      const result = windowManager.sendToMainWindow('test-channel', 'test-data');
      
      expect(result).toBe(true);
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('test-channel', 'test-data');
    });

    it('should return false when no valid window', () => {
      const result = windowManager.sendToMainWindow('test-channel', 'test-data');
      
      expect(result).toBe(false);
      expect(mockBrowserWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('focusMainWindow', () => {
    it('should focus valid main window', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      
      const result = windowManager.focusMainWindow();
      
      expect(result).toBe(true);
      expect(mockBrowserWindow.focus).toHaveBeenCalled();
    });

    it('should return false when no valid window', () => {
      const result = windowManager.focusMainWindow();
      
      expect(result).toBe(false);
      expect(mockBrowserWindow.focus).not.toHaveBeenCalled();
    });
  });

  describe('minimizeMainWindow', () => {
    it('should minimize valid main window', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      
      const result = windowManager.minimizeMainWindow();
      
      expect(result).toBe(true);
      expect(mockBrowserWindow.minimize).toHaveBeenCalled();
    });

    it('should return false when no valid window', () => {
      const result = windowManager.minimizeMainWindow();
      
      expect(result).toBe(false);
      expect(mockBrowserWindow.minimize).not.toHaveBeenCalled();
    });
  });

  describe('toggleMaximizeMainWindow', () => {
    it('should maximize when not maximized', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      mockBrowserWindow.isMaximized.mockReturnValue(false);
      
      const result = windowManager.toggleMaximizeMainWindow();
      
      expect(result).toBe(true);
      expect(mockBrowserWindow.maximize).toHaveBeenCalled();
      expect(mockBrowserWindow.unmaximize).not.toHaveBeenCalled();
    });

    it('should unmaximize when maximized', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await windowManager.createMainWindow();
      mockBrowserWindow.isMaximized.mockReturnValue(true);
      
      const result = windowManager.toggleMaximizeMainWindow();
      
      expect(result).toBe(true);
      expect(mockBrowserWindow.unmaximize).toHaveBeenCalled();
      expect(mockBrowserWindow.maximize).not.toHaveBeenCalled();
    });

    it('should return false when no valid window', () => {
      const result = windowManager.toggleMaximizeMainWindow();
      
      expect(result).toBe(false);
      expect(mockBrowserWindow.isMaximized).not.toHaveBeenCalled();
    });
  });
});