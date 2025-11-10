/**
 * @fileoverview Window management module for Electron main process
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { getLogger } = require('../logging/logger.js');

/**
 * @typedef {Object} WindowConfig
 * @property {number} width - Window width
 * @property {number} height - Window height
 * @property {boolean} show - Whether to show window initially
 * @property {boolean} maximize - Whether to maximize window
 * @property {Object} webPreferences - Web preferences
 */

/**
 * @typedef {Object} WindowManagerConfig
 * @property {string} basePath - Base path for renderer files
 * @property {string} userDataPath - User data path
 * @property {WindowConfig} windowConfig - Window configuration
 */

/**
 * Window manager class for Electron applications
 */
class WindowManager {
  /**
   * Create a new WindowManager instance
   * @param {WindowManagerConfig} config - Window manager configuration
   */
  constructor(config = {}) {
    this.logger = getLogger('WindowManager');
    this.mainWindow = null;
    this.config = {
      basePath: config.basePath || __dirname,
      userDataPath: config.userDataPath,
      windowConfig: {
        width: 900,
        height: 600,
        show: false,
        maximize: true,
        webPreferences: {
          preload: path.resolve(__dirname, '..', '..', '..', 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          ...config.windowConfig?.webPreferences
        },
        ...config.windowConfig
      }
    };
  }

  /**
   * Create and show the main application window
   * @returns {Promise<BrowserWindow>} The created window
   */
  async createMainWindow() {
    this.logger.info('🪟 Creating main window with modular architecture');
    
    this.mainWindow = new BrowserWindow({
      width: this.config.windowConfig.width,
      height: this.config.windowConfig.height,
      show: this.config.windowConfig.show,
      webPreferences: this.config.windowConfig.webPreferences
    });

    // Maximize window if configured
    if (this.config.windowConfig.maximize) {
      this.mainWindow.maximize();
    }

    // Show window
    this.mainWindow.show();

    // Load appropriate content based on first-time user status
    const isFirstTime = await this.checkFirstTimeUser();
    
    if (isFirstTime) {
      this.logger.info('👋 First time user - showing welcome screen');
      this.mainWindow.loadFile(path.join(this.config.basePath, 'renderer', 'welcome.html'));
    } else {
      this.logger.info('🏠 Returning user - showing main screen');
      this.mainWindow.loadFile(path.join(this.config.basePath, 'renderer', 'index.html'));
    }

    // Hide menu bar
    Menu.setApplicationMenu(null);

    this.logger.info('✅ Main window created and shown successfully');
    
    return this.mainWindow;
  }

  /**
   * Check if it's the first time the user is running the app
   * @returns {Promise<boolean>} True if first time user
   */
  checkFirstTimeUser() {
    return new Promise((resolve) => {
      if (!this.config.userDataPath) {
        this.logger.warn('⚠️ userDataPath not configured, assuming returning user');
        resolve(false);
        return;
      }

      const firstTimeFile = path.join(this.config.userDataPath, '.first-time');
      
      if (fs.existsSync(firstTimeFile)) {
        resolve(false);
      } else {
        fs.writeFileSync(firstTimeFile, 'true');
        resolve(true);
      }
    });
  }

  /**
   * Get the main window instance
   * @returns {BrowserWindow|null} The main window or null if not created
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * Check if main window exists and is not destroyed
   * @returns {boolean} True if window is valid
   */
  hasValidMainWindow() {
    return this.mainWindow && !this.mainWindow.isDestroyed();
  }

  /**
   * Close the main window
   */
  closeMainWindow() {
    if (this.hasValidMainWindow()) {
      this.logger.info('🔒 Closing main window');
      this.mainWindow.close();
      this.mainWindow = null;
    }
  }

  /**
   * Create a new window with custom configuration
   * @param {WindowConfig} windowConfig - Custom window configuration
   * @returns {BrowserWindow} The created window
   */
  createCustomWindow(windowConfig = {}) {
    const config = {
      ...this.config.windowConfig,
      ...windowConfig,
      webPreferences: {
        ...this.config.windowConfig.webPreferences,
        ...windowConfig.webPreferences
      }
    };

    this.logger.info('🪟 Creating custom window with config:', config);
    
    const window = new BrowserWindow(config);
    
    if (config.maximize) {
      window.maximize();
    }
    
    if (config.show !== false) {
      window.show();
    }

    return window;
  }

  /**
   * Get all open windows
   * @returns {Array<BrowserWindow>} Array of open windows
   */
  getAllWindows() {
    return BrowserWindow.getAllWindows();
  }

  /**
   * Send a message to the main window
   * @param {string} channel - IPC channel
   * @param {...any} args - Arguments to send
   * @returns {boolean} True if message was sent
   */
  sendToMainWindow(channel, ...args) {
    if (this.hasValidMainWindow()) {
      this.mainWindow.webContents.send(channel, ...args);
      return true;
    }
    return false;
  }

  /**
   * Focus the main window
   * @returns {boolean} True if window was focused
   */
  focusMainWindow() {
    if (this.hasValidMainWindow()) {
      this.mainWindow.focus();
      return true;
    }
    return false;
  }

  /**
   * Minimize the main window
   * @returns {boolean} True if window was minimized
   */
  minimizeMainWindow() {
    if (this.hasValidMainWindow()) {
      this.mainWindow.minimize();
      return true;
    }
    return false;
  }

  /**
   * Toggle maximize state of main window
   * @returns {boolean} True if operation was successful
   */
  toggleMaximizeMainWindow() {
    if (this.hasValidMainWindow()) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
      return true;
    }
    return false;
  }
}

module.exports = {
  WindowManager
};