const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (page) => ipcRenderer.send('navigate', page),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  saveProject: (projectData) => ipcRenderer.invoke('save-project', projectData)
});
