/**
 * @fileoverview Tests for browser IPC handlers
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserHandlers } from '../../src/ipc/browser.js';

// Mock dependencies
vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn(),
      removeHandler: vi.fn()
    },
    BrowserView: vi.fn().mockImplementation((options) => ({
      webPreferences: options,
      webContents: {
        once: vi.fn(),
        loadURL: vi.fn(),
        getURL: vi.fn().mockReturnValue('https://example.com'),
        capturePage: vi.fn().mockResolvedValue({
          toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock')
        }),
        isDestroyed: vi.fn().mockReturnValue(false),
        canGoBack: vi.fn().mockReturnValue(true),
        goBack: vi.fn(),
        reload: vi.fn(),
        clearHistory: vi.fn(),
        close: vi.fn(),
        session: {
          clearCache: vi.fn().mockResolvedValue(),
          clearStorageData: vi.fn().mockResolvedValue()
        }
      },
      setBounds: vi.fn()
    })),
    BrowserWindow: {
      fromWebContents: vi.fn(),
      getAllWindows: vi.fn().mockReturnValue([])
    }
  };
});

describe('BrowserHandlers', () => {
  let browserHandlers;
  let mockLogger;
  let mockWindowManager;
  let mockWindow;
  let mockEvent;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    mockWindowManager = {
      getMainWindow: vi.fn()
    };

    mockWindow = {
      id: 1,
      addBrowserView: vi.fn(),
      removeBrowserView: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: {
        send: vi.fn()
      }
    };

    mockEvent = {
      sender: {
        id: 1
      }
    };

    browserHandlers = new BrowserHandlers({
      logger: mockLogger,
      windowManager: mockWindowManager
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up windowBrowserViews map
    browserHandlers.windowBrowserViews.clear();
  });

  describe('constructor', () => {
    it('should create instance with dependencies', () => {
      expect(browserHandlers.logger).toBe(mockLogger);
      expect(browserHandlers.windowManager).toBe(mockWindowManager);
      expect(browserHandlers.windowBrowserViews).toBeInstanceOf(Map);
    });
  });

  describe('getOrCreateBrowserViews', () => {
    it('should create new BrowserViews for window', () => {
      const { BrowserView } = require('electron');
      
      const result = browserHandlers.getOrCreateBrowserViews(mockWindow);
      
      expect(BrowserView).toHaveBeenCalledTimes(2); // editorView and viewerView
      expect(result).toHaveProperty('editorView');
      expect(result).toHaveProperty('viewerView');
      expect(browserHandlers.windowBrowserViews.has(mockWindow)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Created BrowserViews for window 1');
    });

    it('should return existing BrowserViews for window', () => {
      const { BrowserView } = require('electron');
      
      // First call creates views
      const firstResult = browserHandlers.getOrCreateBrowserViews(mockWindow);
      
      // Second call should return same views
      const secondResult = browserHandlers.getOrCreateBrowserViews(mockWindow);
      
      expect(BrowserView).toHaveBeenCalledTimes(2);
      expect(firstResult).toBe(secondResult);
    });
  });

  describe('getBrowserViewsForEvent', () => {
    it('should return BrowserViews for valid window', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const result = browserHandlers.getBrowserViewsForEvent(mockEvent);
      
      expect(BrowserWindow.fromWebContents).toHaveBeenCalledWith(mockEvent.sender);
      expect(result).toHaveProperty('editorView');
      expect(result).toHaveProperty('viewerView');
    });

    it('should fallback to main window when window not found', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(null);
      mockWindowManager.getMainWindow.mockReturnValue(mockWindow);
      
      const result = browserHandlers.getBrowserViewsForEvent(mockEvent);
      
      expect(mockWindowManager.getMainWindow).toHaveBeenCalled();
      expect(result).toHaveProperty('editorView');
      expect(result).toHaveProperty('viewerView');
    });

    it('should return null views when no window available', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(null);
      mockWindowManager.getMainWindow.mockReturnValue(null);
      
      const result = browserHandlers.getBrowserViewsForEvent(mockEvent);
      
      expect(result).toEqual({ editorView: null, viewerView: null });
    });
  });

  describe('trackBrowserViewLoad', () => {
    it('should set up load tracking for BrowserView', () => {
      const mockView = {
        webContents: {
          once: vi.fn(),
          getURL: vi.fn().mockReturnValue('https://example.com')
        }
      };

      browserHandlers.trackBrowserViewLoad(mockView, 'editor', mockWindow);
      
      expect(mockView.webContents.once).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
      expect(mockView.webContents.once).toHaveBeenCalledWith('did-fail-load', expect.any(Function));
    });

    it('should handle load completion', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
      
      const mockView = {
        webContents: {
          once: vi.fn().mockImplementation((event, callback) => {
            if (event === 'did-finish-load') {
              callback();
            }
          }),
          getURL: vi.fn().mockReturnValue('https://example.com')
        }
      };

      browserHandlers.trackBrowserViewLoad(mockView, 'editor', mockWindow);
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('browser-view-loaded', {
        viewName: 'editor',
        url: 'https://example.com'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('✅ editor BrowserView loaded: https://example.com');
    });

    it('should handle load failure', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
      
      const mockView = {
        webContents: {
          once: vi.fn().mockImplementation((event, callback) => {
            if (event === 'did-fail-load') {
              callback({}, 404, 'Not Found');
            }
          })
        }
      };

      browserHandlers.trackBrowserViewLoad(mockView, 'editor', mockWindow);
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('browser-view-error', {
        viewName: 'editor',
        error: 'Not Found (404)'
      });
      expect(mockLogger.error).toHaveBeenCalledWith('❌ editor BrowserView failed to load:', expect.any(Error));
    });
  });

  describe('setBrowserViewBounds', () => {
    it('should set bounds for editor view', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const bounds = { x: 0, y: 0, width: 800, height: 600 };
      const mockView = { setBounds: vi.fn() };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      browserHandlers.setBrowserViewBounds(mockEvent, 'editor', bounds);
      
      expect(mockView.setBounds).toHaveBeenCalledWith(bounds);
      expect(mockLogger.debug).toHaveBeenCalledWith('Set editor BrowserView bounds:', bounds);
    });
  });

  describe('loadBrowserViewUrl', () => {
    it('should load URL in editor view', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = { webContents: { loadURL: vi.fn() } };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });
      browserHandlers.trackBrowserViewLoad = vi.fn();

      browserHandlers.loadBrowserViewUrl(mockEvent, 'editor', 'https://example.com');
      
      expect(mockView.webContents.loadURL).toHaveBeenCalledWith('https://example.com');
      expect(browserHandlers.trackBrowserViewLoad).toHaveBeenCalledWith(mockView, 'editor', mockWindow);
      expect(mockLogger.info).toHaveBeenCalledWith('🔗 Loading editor BrowserView with URL: https://example.com');
    });

    it('should log warning when view not found', () => {
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: null,
        viewerView: null
      });

      browserHandlers.loadBrowserViewUrl(mockEvent, 'editor', 'https://example.com');
      
      expect(mockLogger.warn).toHaveBeenCalledWith('❌ BrowserView not found for editor');
    });
  });

  describe('setBrowserViewVisibility', () => {
    it('should show editor view', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = { webContents: {} };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      browserHandlers.setBrowserViewVisibility(mockEvent, 'editor', true);
      
      expect(mockWindow.addBrowserView).toHaveBeenCalledWith(mockView);
      expect(mockLogger.debug).toHaveBeenCalledWith('Set editor BrowserView visibility: true');
    });

    it('should hide editor view', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = { webContents: {} };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      browserHandlers.setBrowserViewVisibility(mockEvent, 'editor', false);
      
      expect(mockWindow.removeBrowserView).toHaveBeenCalledWith(mockView);
    });
  });

  describe('setAllBrowserViewVisibility', () => {
    it('should show all views', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockEditorView = { webContents: {} };
      const mockViewerView = { webContents: {} };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockEditorView,
        viewerView: mockViewerView
      });

      browserHandlers.setAllBrowserViewVisibility(mockEvent, true);
      
      expect(mockWindow.addBrowserView).toHaveBeenCalledWith(mockEditorView);
      expect(mockWindow.addBrowserView).toHaveBeenCalledWith(mockViewerView);
    });

    it('should hide all views', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockEditorView = { webContents: {} };
      const mockViewerView = { webContents: {} };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockEditorView,
        viewerView: mockViewerView
      });

      browserHandlers.setAllBrowserViewVisibility(mockEvent, false);
      
      expect(mockWindow.removeBrowserView).toHaveBeenCalledWith(mockEditorView);
      expect(mockWindow.removeBrowserView).toHaveBeenCalledWith(mockViewerView);
    });
  });

  describe('captureBrowserViewPage', () => {
    it('should capture page screenshot', async () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          capturePage: vi.fn().mockResolvedValue({
            toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock')
          })
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      const result = await browserHandlers.captureBrowserViewPage(mockEvent, 'editor');
      
      expect(result).toBe('data:image/png;base64,mock');
    });

    it('should return null when view not found', async () => {
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: null,
        viewerView: null
      });

      const result = await browserHandlers.captureBrowserViewPage(mockEvent, 'editor');
      
      expect(result).toBeNull();
    });

    it('should handle capture error', async () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          capturePage: vi.fn().mockRejectedValue(new Error('Capture failed'))
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      const result = await browserHandlers.captureBrowserViewPage(mockEvent, 'editor');
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('browserViewGoBack', () => {
    it('should navigate back when possible', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(false),
          canGoBack: vi.fn().mockReturnValue(true),
          goBack: vi.fn()
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });
      browserHandlers.trackBrowserViewLoad = vi.fn();

      const result = browserHandlers.browserViewGoBack(mockEvent, 'editor');
      
      expect(result).toBe(true);
      expect(mockView.webContents.goBack).toHaveBeenCalled();
      expect(browserHandlers.trackBrowserViewLoad).toHaveBeenCalledWith(mockView, 'editor', mockWindow);
    });

    it('should return false when cannot go back', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(false),
          canGoBack: vi.fn().mockReturnValue(false)
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      const result = browserHandlers.browserViewGoBack(mockEvent, 'editor');
      
      expect(result).toBe(false);
      expect(mockView.webContents.goBack).not.toHaveBeenCalled();
    });
  });

  describe('browserViewReload', () => {
    it('should reload view', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(false),
          reload: vi.fn()
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });
      browserHandlers.trackBrowserViewLoad = vi.fn();

      const result = browserHandlers.browserViewReload(mockEvent, 'editor');
      
      expect(result).toBe(true);
      expect(mockView.webContents.reload).toHaveBeenCalled();
      expect(browserHandlers.trackBrowserViewLoad).toHaveBeenCalledWith(mockView, 'editor', mockWindow);
    });

    it('should return false when view is destroyed', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(true)
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      const result = browserHandlers.browserViewReload(mockEvent, 'editor');
      
      expect(result).toBe(false);
      expect(mockView.webContents.reload).not.toHaveBeenCalled();
    });
  });

  describe('getBrowserViewUrl', () => {
    it('should return current URL', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(false),
          getURL: vi.fn().mockReturnValue('https://example.com')
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      const result = browserHandlers.getBrowserViewUrl(mockEvent, 'editor');
      
      expect(result).toBe('https://example.com');
    });

    it('should return null when view is destroyed', () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(true)
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      const result = browserHandlers.getBrowserViewUrl(mockEvent, 'editor');
      
      expect(result).toBeNull();
    });
  });

  describe('clearBrowserCache', () => {
    it('should clear cache for both views', async () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockEditorView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(false),
          session: {
            clearCache: vi.fn().mockResolvedValue(),
            clearStorageData: vi.fn().mockResolvedValue()
          },
          clearHistory: vi.fn()
        }
      };
      
      const mockViewerView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(false),
          session: {
            clearCache: vi.fn().mockResolvedValue(),
            clearStorageData: vi.fn().mockResolvedValue()
          },
          clearHistory: vi.fn()
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockEditorView,
        viewerView: mockViewerView
      });

      const result = await browserHandlers.clearBrowserCache(mockEvent);
      
      expect(result).toEqual({ success: true });
      expect(mockEditorView.webContents.session.clearCache).toHaveBeenCalled();
      expect(mockEditorView.webContents.session.clearStorageData).toHaveBeenCalled();
      expect(mockEditorView.webContents.clearHistory).toHaveBeenCalled();
      expect(mockViewerView.webContents.session.clearCache).toHaveBeenCalled();
      expect(mockViewerView.webContents.session.clearStorageData).toHaveBeenCalled();
      expect(mockViewerView.webContents.clearHistory).toHaveBeenCalled();
    });

    it('should handle cache clearing error', async () => {
      const { BrowserWindow } = require('electron');
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      
      const mockView = {
        webContents: {
          isDestroyed: vi.fn().mockReturnValue(false),
          session: {
            clearCache: vi.fn().mockRejectedValue(new Error('Cache error'))
          }
        }
      };
      
      browserHandlers.getBrowserViewsForEvent = vi.fn().mockReturnValue({
        editorView: mockView,
        viewerView: null
      });

      const result = await browserHandlers.clearBrowserCache(mockEvent);
      
      expect(result).toEqual({ success: false, error: 'Cache error' });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('cleanupWindowBrowserViews', () => {
    it('should clean up BrowserViews for window', () => {
      const mockEditorView = { webContents: { close: vi.fn(), isDestroyed: vi.fn().mockReturnValue(false) } };
      const mockViewerView = { webContents: { close: vi.fn(), isDestroyed: vi.fn().mockReturnValue(false) } };
      
      // Create views for window
      browserHandlers.getOrCreateBrowserViews(mockWindow);
      
      // Replace with mock views for testing
      browserHandlers.windowBrowserViews.set(mockWindow, {
        editorView: mockEditorView,
        viewerView: mockViewerView
      });

      browserHandlers.cleanupWindowBrowserViews(mockWindow);
      
      expect(mockEditorView.webContents.close).toHaveBeenCalled();
      expect(mockViewerView.webContents.close).toHaveBeenCalled();
      expect(browserHandlers.windowBrowserViews.has(mockWindow)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up BrowserViews for window 1');
    });

    it('should not clean up when window has no views', () => {
      browserHandlers.cleanupWindowBrowserViews(mockWindow);
      
      expect(browserHandlers.windowBrowserViews.has(mockWindow)).toBe(false);
    });
  });

  describe('registerHandlers', () => {
    it('should register all browser IPC handlers', () => {
      const { ipcMain } = require('electron');
      
      browserHandlers.registerHandlers();
      
      expect(ipcMain.handle).toHaveBeenCalledWith('set-browser-view-bounds', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('load-browser-view-url', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('set-browser-view-visibility', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('set-all-browser-view-visibility', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('capture-browser-view-page', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('browser-view-go-back', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('browser-view-reload', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('get-browser-view-url', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('clear-browser-cache', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('🌐 Registering BrowserView management IPC handlers');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ BrowserView management IPC handlers registered');
    });
  });

  describe('unregisterHandlers', () => {
    it('should unregister all browser IPC handlers', () => {
      const { ipcMain } = require('electron');
      
      browserHandlers.unregisterHandlers();
      
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('set-browser-view-bounds');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('load-browser-view-url');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('set-browser-view-visibility');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('set-all-browser-view-visibility');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('capture-browser-view-page');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('browser-view-go-back');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('browser-view-reload');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('get-browser-view-url');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('clear-browser-cache');
      expect(mockLogger.info).toHaveBeenCalledWith('🌐 Unregistering BrowserView management IPC handlers');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ BrowserView management IPC handlers unregistered');
    });
  });
});