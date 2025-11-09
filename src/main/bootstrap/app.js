function bootstrapApp({
  app,
  createWindow,
  initializeDatabase,
  registerHandlers,
  onActivate,
  onBeforeQuit,
  onWindowAllClosed
} = {}) {
  if (!app || typeof app.whenReady !== 'function') {
    throw new Error('Electron app instance with whenReady is required');
  }
  if (typeof createWindow !== 'function') {
    throw new Error('createWindow function is required');
  }
  if (typeof initializeDatabase !== 'function') {
    throw new Error('initializeDatabase function is required');
  }

  app.whenReady().then(async () => {
    await createWindow();
    await initializeDatabase();
    if (typeof registerHandlers === 'function') {
      registerHandlers();
    }
  });

  if (typeof onActivate === 'function') {
    app.on('activate', onActivate);
  }

  if (typeof onBeforeQuit === 'function') {
    app.on('before-quit', onBeforeQuit);
  }

  if (typeof onWindowAllClosed === 'function') {
    app.on('window-all-closed', onWindowAllClosed);
  }
}

module.exports = {
  bootstrapApp
};
