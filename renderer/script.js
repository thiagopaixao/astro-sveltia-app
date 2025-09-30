document.addEventListener('DOMContentLoaded', async () => {
  const navigateButtons = document.querySelectorAll('[data-navigate]');
  const projectPathInput = document.getElementById('project-path');
  const selectFolderButton = document.getElementById('select-folder-button');
  const createProjectButton = document.getElementById('create-project-button');
  const projectNameInput = document.getElementById('project-name');
  const githubUrlInput = document.getElementById('github-url');

  navigateButtons.forEach(button => {
    button.addEventListener('click', () => {
      const page = button.dataset.navigate;
      if (window.electronAPI && window.electronAPI.navigateTo) {
        window.electronAPI.navigateTo(page);
      } else {
        console.error('Electron API not available or navigateTo function missing.');
      }
    });
  });

  // Set default project path
  if (window.electronAPI && window.electronAPI.getHomeDirectory) {
    const homeDir = await window.electronAPI.getHomeDirectory();
    projectPathInput.value = `${homeDir}/Workspaces/`;
  } else {
    console.error('Electron API not available or getHomeDirectory function missing.');
  }

  // Handle folder selection
  if (selectFolderButton && window.electronAPI && window.electronAPI.openDirectoryDialog) {
    selectFolderButton.addEventListener('click', async () => {
      const selectedPath = await window.electronAPI.openDirectoryDialog();
      if (selectedPath) {
        projectPathInput.value = selectedPath;
      }
    });
  } else {
    console.error('Select folder button or Electron API for openDirectoryDialog missing.');
  }

  // Handle project creation
  if (createProjectButton && window.electronAPI && window.electronAPI.saveProject) {
    createProjectButton.addEventListener('click', async () => {
      const projectName = projectNameInput.value;
      const githubUrl = githubUrlInput.value;
      const projectPath = projectPathInput.value;

      if (!projectName || !githubUrl || !projectPath) {
        alert('Por favor, preencha todos os campos.');
        return;
      }

      try {
        const projectId = await window.electronAPI.saveProject({ projectName, githubUrl, projectPath });
        alert(`Projeto "${projectName}" criado com sucesso! ID: ${projectId}`);
        // Optionally navigate to another page or clear the form
        window.electronAPI.navigateTo('main.html'); // Navigate to main page after creation
      } catch (error) {
        alert(`Erro ao criar projeto: ${error}`);
        console.error('Error saving project:', error);
      }
    });
  } else {
    console.error('Create project button or Electron API for saveProject missing.');
  }
});
