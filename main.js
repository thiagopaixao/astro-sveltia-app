const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Hide the menu bar
  Menu.setApplicationMenu(null);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

let db;

function initializeDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'documental.db');

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
      db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectName TEXT NOT NULL,
        githubUrl TEXT NOT NULL,
        projectPath TEXT NOT NULL
      )`, (err) => {
        if (err) {
          console.error('Error creating projects table:', err.message);
        } else {
          console.log('Projects table ensured.');
        }
      });
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  initializeDatabase();

  ipcMain.handle('get-home-directory', () => {
    return app.getPath('home');
  });

  ipcMain.handle('open-directory-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  ipcMain.handle('save-project', async (event, projectData) => {
    return new Promise((resolve, reject) => {
      const { projectName, githubUrl, projectPath } = projectData;
      db.run(`INSERT INTO projects (projectName, githubUrl, projectPath) VALUES (?, ?, ?)`,
        [projectName, githubUrl, projectPath],
        function (err) {
          if (err) {
            console.error('Error saving project:', err.message);
            reject(err.message);
          } else {
            console.log(`A row has been inserted with rowid ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('navigate', (event, page) => {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', page));
  }
});
