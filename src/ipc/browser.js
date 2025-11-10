/**
 * @fileoverview IPC handlers for BrowserView management operations
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { ipcMain, BrowserView, BrowserWindow } = require('electron');

/**
 * @typedef {Object} BrowserViewBounds
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} width - Width
 * @property {number} height - Height
 */

/**
 * BrowserView Management IPC Handlers
 */
class BrowserHandlers {
  /**
   * Create an instance of BrowserHandlers
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.windowManager - Window manager instance
   */
  constructor({ logger, windowManager }) {
    this.logger = logger;
    this.windowManager = windowManager;
    this.windowBrowserViews = new Map(); // Store BrowserViews per window
  }

  /**
   * Get or create BrowserViews for a window
   * @param {BrowserWindow} window - BrowserWindow instance
   * @returns {Object} Object containing editorView and viewerView
   */
  getOrCreateBrowserViews(window) {
    if (!this.windowBrowserViews.has(window)) {
      const editorView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          webSecurity: true
        }
      });

      const viewerView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          webSecurity: true
        }
      });

      this.windowBrowserViews.set(window, { editorView, viewerView });
      this.logger.info(`Created BrowserViews for window ${window.id}`);
    }

    return this.windowBrowserViews.get(window);
  }

  /**
   * Get BrowserViews for the window that sent the IPC event
   * @param {Object} event - IPC event object
   * @returns {Object} Object containing editorView and viewerView
   */
  getBrowserViewsForEvent(event) {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      // Fallback to main window for backward compatibility
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        return this.getOrCreateBrowserViews(mainWindow);
      }
      return { editorView: null, viewerView: null };
    }
    return this.getOrCreateBrowserViews(window);
  }

  /**
   * Track BrowserView loading and broadcast completion
   * @param {BrowserView} view - BrowserView instance
   * @param {string} viewName - Name of the view ('editor' or 'viewer')
   * @param {BrowserWindow} window - Parent window
   */
  trackBrowserViewLoad(view, viewName, window) {
    if (!view || !window) return;

    let loadingTimeout;
    
    const handleLoad = () => {
      clearTimeout(loadingTimeout);
      const currentUrl = view.webContents.getURL();
      
      // Broadcast to all windows for synchronization
      BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) {
          w.webContents.send('browser-view-loaded', { viewName, url: currentUrl });
        }
      });
      
      this.logger.info(`✅ ${viewName} BrowserView loaded: ${currentUrl}`);
    };

    const handleError = (error) => {
      clearTimeout(loadingTimeout);
      this.logger.error(`❌ ${viewName} BrowserView failed to load:`, error);
      
      // Broadcast error to all windows
      BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) {
          w.webContents.send('browser-view-error', { viewName, error: error.message });
        }
      });
    };

    // Set up event listeners
    view.webContents.once('did-finish-load', handleLoad);
    view.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
      handleError(new Error(`${errorDescription} (${errorCode})`));
    });

    // Set timeout for loading
    loadingTimeout = setTimeout(() => {
      handleError(new Error('Loading timeout after 8 seconds'));
    }, 8000);
  }

  /**
   * Set BrowserView bounds
   * @param {Object} event - IPC event object
   * @param {string} viewName - Name of the view ('editor' or 'viewer')
   * @param {BrowserViewBounds} bounds - Bounds to set
   */
  setBrowserViewBounds(event, viewName, bounds) {
    const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
    const view = viewName === 'editor' ? editorView : viewerView;
    const window = BrowserWindow.fromWebContents(event.sender);
    
    if (view && window) {
      view.setBounds(bounds);
      this.logger.debug(`Set ${viewName} BrowserView bounds:`, bounds);
    }
  }

  /**
   * Load URL in BrowserView
   * @param {Object} event - IPC event object
   * @param {string} viewName - Name of the view ('editor' or 'viewer')
   * @param {string} url - URL to load
   */
  loadBrowserViewUrl(event, viewName, url) {
    const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    const view = viewName === 'editor' ? editorView : viewerView;
    
    if (view) {
      this.logger.info(`🔗 Loading ${viewName} BrowserView with URL: ${url}`);
      this.trackBrowserViewLoad(view, viewName, window);
      view.webContents.loadURL(url);
    } else {
      this.logger.warn(`❌ BrowserView not found for ${viewName}`);
    }
  }

  /**
   * Set BrowserView visibility
   * @param {Object} event - IPC event object
   * @param {string} viewName - Name of the view ('editor' or 'viewer')
   * @param {boolean} visible - Whether to show or hide the view
   */
  setBrowserViewVisibility(event, viewName, visible) {
    const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
    const view = viewName === 'editor' ? editorView : viewerView;
    const window = BrowserWindow.fromWebContents(event.sender);
    
    if (view && window) {
      if (visible) {
        window.addBrowserView(view);
      } else {
        window.removeBrowserView(view);
      }
      this.logger.debug(`Set ${viewName} BrowserView visibility: ${visible}`);
    }
  }

  /**
   * Set visibility for all BrowserViews
   * @param {Object} event - IPC event object
   * @param {boolean} visible - Whether to show or hide all views
   */
  setAllBrowserViewVisibility(event, visible) {
    const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    
    if (editorView && window) {
      if (visible) {
        window.addBrowserView(editorView);
      } else {
        window.removeBrowserView(editorView);
      }
    }
    
    if (viewerView && window) {
      if (visible) {
        window.addBrowserView(viewerView);
      } else {
        window.removeBrowserView(viewerView);
      }
    }
    
    this.logger.debug(`Set all BrowserViews visibility: ${visible}`);
  }

  /**
   * Capture page screenshot from BrowserView
   * @param {Object} event - IPC event object
   * @param {string} viewName - Name of the view ('editor' or 'viewer')
   * @returns {Promise<string|null>} Base64 data URL of the screenshot
   */
  async captureBrowserViewPage(event, viewName) {
    const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
    const view = viewName === 'editor' ? editorView : viewerView;
    
    if (view) {
      try {
        const image = await view.webContents.capturePage();
        return image.toDataURL(); // Convert NativeImage to base64 data URL
      } catch (error) {
        this.logger.error(`Error capturing page for ${viewName} view:`, error);
        return null;
      }
    }
    return null;
  }

  /**
   * Navigate back in BrowserView
   * @param {Object} event - IPC event object
   * @param {string} viewName - Name of the view ('editor' or 'viewer')
   * @returns {boolean} Whether navigation was successful
   */
  browserViewGoBack(event, viewName) {
    const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    const view = viewName === 'editor' ? editorView : viewerView;
    
    if (view && !view.webContents.isDestroyed() && view.webContents.canGoBack()) {
      this.trackBrowserViewLoad(view, viewName, window);
      view.webContents.goBack();
      return true;
    }
    return false;
  }

  /**
   * Reload BrowserView
   * @param {Object} event - IPC event object
   * @param {string} viewName - Name of the view ('editor' or 'viewer')
   * @returns {boolean} Whether reload was successful
   */
  browserViewReload(event, viewName) {
    const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    const view = viewName === 'editor' ? editorView : viewerView;
    
    if (view && !view.webContents.isDestroyed()) {
      this.trackBrowserViewLoad(view, viewName, window);
      view.webContents.reload();
      return true;
    }
    return false;
  }

  /**
   * Get current URL from BrowserView
   * @param {Object} event - IPC event object
   * @param {string} viewName - Name of the view ('editor' or 'viewer')
   * @returns {string|null} Current URL
   */
  getBrowserViewUrl(event, viewName) {
    const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
    const view = viewName === 'editor' ? editorView : viewerView;
    
    if (view && !view.webContents.isDestroyed()) {
      return view.webContents.getURL();
    }
    return null;
  }

  /**
   * Clear browser cache and storage data
   * @param {Object} event - IPC event object
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearBrowserCache(event) {
    try {
      const { editorView, viewerView } = this.getBrowserViewsForEvent(event);
      
      const clearViewCache = async (view) => {
        if (view && !view.webContents.isDestroyed()) {
          // Clear cache
          await view.webContents.session.clearCache();
          // Clear storage data (cookies, localStorage, sessionStorage, etc.)
          await view.webContents.session.clearStorageData({
            storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
          });
          // Clear navigation history
          view.webContents.clearHistory();
        }
      };

      // Clear cache for both BrowserViews of calling window
      await Promise.all([
        clearViewCache(editorView),
        clearViewCache(viewerView)
      ]);

      this.logger.info('✅ Browser cache cleared successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Error clearing browser cache:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up BrowserViews for a window
   * @param {BrowserWindow} window - Window to clean up
   */
  cleanupWindowBrowserViews(window) {
    if (this.windowBrowserViews.has(window)) {
      const { editorView, viewerView } = this.windowBrowserViews.get(window);
      
      // Clean up BrowserViews
      if (editorView && !editorView.webContents.isDestroyed()) {
        editorView.webContents.close();
      }
      if (viewerView && !viewerView.webContents.isDestroyed()) {
        viewerView.webContents.close();
      }
      
      this.windowBrowserViews.delete(window);
      this.logger.info(`Cleaned up BrowserViews for window ${window.id}`);
    }
  }

  /**
   * Register all BrowserView management IPC handlers
   */
  registerHandlers() {
    this.logger.info('🌐 Registering BrowserView management IPC handlers');

    /**
     * Set BrowserView bounds
     */
    ipcMain.handle('set-browser-view-bounds', (event, viewName, bounds) => {
      this.setBrowserViewBounds(event, viewName, bounds);
    });

    /**
     * Load URL in BrowserView
     */
    ipcMain.handle('load-browser-view-url', (event, viewName, url) => {
      this.loadBrowserViewUrl(event, viewName, url);
    });

    /**
     * Set BrowserView visibility
     */
    ipcMain.handle('set-browser-view-visibility', (event, viewName, visible) => {
      this.setBrowserViewVisibility(event, viewName, visible);
    });

    /**
     * Set visibility for all BrowserViews
     */
    ipcMain.handle('set-all-browser-view-visibility', (event, visible) => {
      this.setAllBrowserViewVisibility(event, visible);
    });

    /**
     * Capture page screenshot
     */
    ipcMain.handle('capture-browser-view-page', async (event, viewName) => {
      return await this.captureBrowserViewPage(event, viewName);
    });

    /**
     * Navigate back
     */
    ipcMain.handle('browser-view-go-back', (event, viewName) => {
      return this.browserViewGoBack(event, viewName);
    });

    /**
     * Reload BrowserView
     */
    ipcMain.handle('browser-view-reload', (event, viewName) => {
      return this.browserViewReload(event, viewName);
    });

    /**
     * Get current URL
     */
    ipcMain.handle('get-browser-view-url', (event, viewName) => {
      return this.getBrowserViewUrl(event, viewName);
    });

    /**
     * Clear browser cache
     */
    ipcMain.handle('clear-browser-cache', async (event) => {
      return await this.clearBrowserCache(event);
    });

    this.logger.info('✅ BrowserView management IPC handlers registered');
  }

  /**
   * Unregister all BrowserView management IPC handlers
   */
  unregisterHandlers() {
    this.logger.info('🌐 Unregistering BrowserView management IPC handlers');
    
    ipcMain.removeHandler('set-browser-view-bounds');
    ipcMain.removeHandler('load-browser-view-url');
    ipcMain.removeHandler('set-browser-view-visibility');
    ipcMain.removeHandler('set-all-browser-view-visibility');
    ipcMain.removeHandler('capture-browser-view-page');
    ipcMain.removeHandler('browser-view-go-back');
    ipcMain.removeHandler('browser-view-reload');
    ipcMain.removeHandler('get-browser-view-url');
    ipcMain.removeHandler('clear-browser-cache');
    
    this.logger.info('✅ BrowserView management IPC handlers unregistered');
  }
}

module.exports = { BrowserHandlers };