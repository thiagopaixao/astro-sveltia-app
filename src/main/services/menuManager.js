/**
 * @fileoverview Application menu manager
 * @author Documental Team
 * @since 1.0.0
 */

'use strict';

const { Menu, app, shell } = require('electron');

/**
 * @typedef {Object} MenuTemplate
 * @property {Array<Object>} template - Menu template array
 */

/**
 * Menu Manager - Handles application menu creation and management
 */
class MenuManager {
  /**
   * Create an instance of MenuManager
   * @param {Object} dependencies - Dependency injection container
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.windowManager - Window manager instance
   * @param {Object} [dependencies.fileService] - File service instance
   */
  constructor({ logger, windowManager, fileService }) {
    this.logger = logger;
    this.windowManager = windowManager;
    this.fileService = fileService;
    this.currentMenu = null;
  }

  /**
   * Create application menu template
   * @returns {MenuTemplate} Menu template object
   */
  createMenuTemplate() {
    const isMac = process.platform === 'darwin';

    const template = [
      // App menu (macOS only)
      ...(isMac ? [{
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),

      // File menu
      {
        label: 'File',
        submenu: [
          {
            label: 'New Project',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.handleNewProject()
          },
          {
            label: 'Open Project',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.handleOpenProject()
          },
          { type: 'separator' },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => this.handleSave()
          },
          {
            label: 'Save As...',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => this.handleSaveAs()
          },
          { type: 'separator' },
          {
            label: 'Open Project Folder',
            click: () => this.handleOpenProjectFolder()
          },
          { type: 'separator' },
          ...(isMac ? [] : [
            {
              label: 'Exit',
              accelerator: 'CmdOrCtrl+Q',
              click: () => app.quit()
            }
          ])
        ]
      },

      // Edit menu
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          ...(isMac ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
            { type: 'separator' },
            {
              label: 'Speech',
              submenu: [
                { role: 'startSpeaking' },
                { role: 'stopSpeaking' }
              ]
            }
          ] : [
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
          ])
        ]
      },

      // View menu
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          { type: 'separator' },
          {
            label: 'Toggle Browser Views',
            accelerator: 'CmdOrCtrl+B',
            click: () => this.handleToggleBrowserViews()
          },
          {
            label: 'Reset Layout',
            click: () => this.handleResetLayout()
          }
        ]
      },

      // Window menu
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
          ...(isMac ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
          ] : [
            {
              label: 'Select Next Window',
              accelerator: 'Ctrl+Tab',
              click: () => this.handleSelectNextWindow()
            },
            {
              label: 'Select Previous Window',
              accelerator: 'Ctrl+Shift+Tab',
              click: () => this.handleSelectPreviousWindow()
            }
          ])
        ]
      },

      // Help menu
      {
        label: 'Help',
        submenu: [
          {
            label: 'About Documental',
            click: () => this.handleAbout()
          },
          {
            label: 'Documentation',
            click: () => this.handleDocumentation()
          },
          {
            label: 'Report Issue',
            click: () => this.handleReportIssue()
          },
          {
            label: 'Check for Updates',
            click: () => this.handleCheckUpdates()
          },
          { type: 'separator' },
          {
            label: 'Learn More',
            click: async () => {
              await shell.openExternal('https://github.com/documental/documental');
            }
          }
        ]
      }
    ];

    return { template };
  }

  /**
   * Build and set application menu
   */
  buildMenu() {
    try {
      const { template } = this.createMenuTemplate();
      this.currentMenu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(this.currentMenu);
      
      this.logger.info('✅ Application menu built and set successfully');
    } catch (error) {
      this.logger.error('❌ Failed to build application menu:', error);
      throw error;
    }
  }

  /**
   * Get current application menu
   * @returns {Menu|null} Current menu or null
   */
  getCurrentMenu() {
    return this.currentMenu;
  }

  /**
   * Handle new project menu action
   */
  async handleNewProject() {
    try {
      this.logger.info('📝 New project menu action triggered');
      
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Navigate to create project page
        mainWindow.loadFile('renderer/create.html');
      }
    } catch (error) {
      this.logger.error('Error handling new project:', error);
    }
  }

  /**
   * Handle open project menu action
   */
  async handleOpenProject() {
    try {
      this.logger.info('📂 Open project menu action triggered');
      
      if (!this.fileService) {
        this.logger.warn('FileService not available for open project action');
        return;
      }

      const selectedPath = await this.fileService.showOpenDirectoryDialog();
      if (selectedPath) {
        // Send IPC message to handle project opening
        const mainWindow = this.windowManager.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('menu-open-project', { path: selectedPath });
        }
      }
    } catch (error) {
      this.logger.error('Error handling open project:', error);
    }
  }

  /**
   * Handle save menu action
   */
  async handleSave() {
    try {
      this.logger.info('💾 Save menu action triggered');
      
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('menu-save');
      }
    } catch (error) {
      this.logger.error('Error handling save:', error);
    }
  }

  /**
   * Handle save as menu action
   */
  async handleSaveAs() {
    try {
      this.logger.info('💾 Save As menu action triggered');
      
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('menu-save-as');
      }
    } catch (error) {
      this.logger.error('Error handling save as:', error);
    }
  }

  /**
   * Handle open project folder menu action
   */
  async handleOpenProjectFolder() {
    try {
      this.logger.info('📁 Open project folder menu action triggered');
      
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('menu-open-project-folder');
      }
    } catch (error) {
      this.logger.error('Error handling open project folder:', error);
    }
  }

  /**
   * Handle toggle browser views menu action
   */
  async handleToggleBrowserViews() {
    try {
      this.logger.info('🔄 Toggle browser views menu action triggered');
      
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('menu-toggle-browser-views');
      }
    } catch (error) {
      this.logger.error('Error handling toggle browser views:', error);
    }
  }

  /**
   * Handle reset layout menu action
   */
  async handleResetLayout() {
    try {
      this.logger.info('🔄 Reset layout menu action triggered');
      
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('menu-reset-layout');
      }
    } catch (error) {
      this.logger.error('Error handling reset layout:', error);
    }
  }

  /**
   * Handle select next window menu action
   */
  async handleSelectNextWindow() {
    try {
      this.logger.info('🪟 Select next window menu action triggered');
      
      const windows = this.windowManager.getAllWindows();
      const mainWindow = this.windowManager.getMainWindow();
      
      if (windows.length > 1 && mainWindow && !mainWindow.isDestroyed()) {
        // Find current window index and select next
        const currentIndex = windows.findIndex(w => w.id === mainWindow.id);
        const nextIndex = (currentIndex + 1) % windows.length;
        const nextWindow = windows[nextIndex];
        
        if (nextWindow && !nextWindow.isDestroyed()) {
          nextWindow.focus();
        }
      }
    } catch (error) {
      this.logger.error('Error handling select next window:', error);
    }
  }

  /**
   * Handle select previous window menu action
   */
  async handleSelectPreviousWindow() {
    try {
      this.logger.info('🪟 Select previous window menu action triggered');
      
      const windows = this.windowManager.getAllWindows();
      const mainWindow = this.windowManager.getMainWindow();
      
      if (windows.length > 1 && mainWindow && !mainWindow.isDestroyed()) {
        // Find current window index and select previous
        const currentIndex = windows.findIndex(w => w.id === mainWindow.id);
        const prevIndex = currentIndex === 0 ? windows.length - 1 : currentIndex - 1;
        const prevWindow = windows[prevIndex];
        
        if (prevWindow && !prevWindow.isDestroyed()) {
          prevWindow.focus();
        }
      }
    } catch (error) {
      this.logger.error('Error handling select previous window:', error);
    }
  }

  /**
   * Handle about menu action
   */
  async handleAbout() {
    try {
      this.logger.info('ℹ️ About menu action triggered');
      
      const { dialog } = require('electron');
      const mainWindow = this.windowManager.getMainWindow();
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'About Documental',
          message: 'Documental',
          detail: `A modern development environment for documentation projects.\n\nVersion: ${app.getVersion()}\nPlatform: ${process.platform}\nElectron: ${process.versions.electron}\nNode.js: ${process.versions.node}`
        });
      }
    } catch (error) {
      this.logger.error('Error handling about:', error);
    }
  }

  /**
   * Handle documentation menu action
   */
  async handleDocumentation() {
    try {
      this.logger.info('📚 Documentation menu action triggered');
      await shell.openExternal('https://documental.dev/docs');
    } catch (error) {
      this.logger.error('Error handling documentation:', error);
    }
  }

  /**
   * Handle report issue menu action
   */
  async handleReportIssue() {
    try {
      this.logger.info('🐛 Report issue menu action triggered');
      await shell.openExternal('https://github.com/documental/documental/issues');
    } catch (error) {
      this.logger.error('Error handling report issue:', error);
    }
  }

  /**
   * Handle check for updates menu action
   */
  async handleCheckUpdates() {
    try {
      this.logger.info('🔄 Check for updates menu action triggered');
      
      const { dialog } = require('electron');
      const mainWindow = this.windowManager.getMainWindow();
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Check for Updates',
          message: 'Check for Updates',
          detail: 'Documental will check for updates automatically on startup.\n\nFor the latest version, visit: https://github.com/documental/documental/releases'
        });
      }
    } catch (error) {
      this.logger.error('Error handling check for updates:', error);
    }
  }

  /**
   * Update menu state based on application state
   * @param {Object} state - Current application state
   */
  updateMenuState(state = {}) {
    try {
      // This can be used to enable/disable menu items based on app state
      this.logger.debug('Updating menu state:', state);
      
      // Rebuild menu with updated state
      this.buildMenu();
    } catch (error) {
      this.logger.error('Error updating menu state:', error);
    }
  }

  /**
   * Clear application menu
   */
  clearMenu() {
    try {
      Menu.setApplicationMenu(null);
      this.currentMenu = null;
      this.logger.info('Application menu cleared');
    } catch (error) {
      this.logger.error('Error clearing menu:', error);
    }
  }

  /**
   * Initialize menu manager
   */
  initialize() {
    try {
      this.logger.info('🍽️ Initializing MenuManager');
      this.buildMenu();
      this.logger.info('✅ MenuManager initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize MenuManager:', error);
      throw error;
    }
  }

  /**
   * Cleanup menu manager
   */
  cleanup() {
    try {
      this.logger.info('🧹 Cleaning up MenuManager');
      this.clearMenu();
      this.logger.info('✅ MenuManager cleaned up successfully');
    } catch (error) {
      this.logger.error('Error cleaning up MenuManager:', error);
    }
  }
}

module.exports = { MenuManager };