const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (page) => ipcRenderer.send('navigate', page),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  saveProject: (projectData) => ipcRenderer.invoke('save-project', projectData),
  getProjectDetails: (projectId) => ipcRenderer.invoke('get-project-details', projectId),
  startProjectCreation: (projectId, projectPath, githubUrl) => ipcRenderer.invoke('start-project-creation', projectId, projectPath, githubUrl),
  cancelProjectCreation: (projectId, projectPath, repoFolderName) => ipcRenderer.invoke('cancel-project-creation', projectId, projectPath, repoFolderName),
  onCommandOutput: (callback) => ipcRenderer.on('command-output', (event, ...args) => callback(...args)),
  onCommandStatus: (callback) => ipcRenderer.on('command-status', (event, ...args) => callback(...args)),
  onDevServerUrl: (callback) => ipcRenderer.on('dev-server-url', (event, ...args) => callback(...args))
});
