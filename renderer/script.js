document.addEventListener('DOMContentLoaded', async () => {
  const navigateButtons = document.querySelectorAll('[data-navigate]');
  const projectPathInput = document.getElementById('project-path');
  const selectFolderButton = document.getElementById('select-folder-button');
  const createProjectButton = document.getElementById('create-project-button');
  const projectNameInput = document.getElementById('project-name');
  const githubUrlInput = document.getElementById('github-url');

  // Load recent projects
  await loadRecentProjects();

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
        sessionStorage.setItem('currentProjectId', projectId);
        window.electronAPI.navigateTo('create.html'); // Navigate to create page after creation
      } catch (error) {
        alert(`Erro ao criar projeto: ${error}`);
        console.error('Error saving project:', error);
      }
    });
  } else {
    console.error('Create project button or Electron API for saveProject missing.');
  }

  // Function to load recent projects
  async function loadRecentProjects() {
    const recentProjectsContainer = document.getElementById('recent-projects-container');
    if (!recentProjectsContainer) return;

    try {
      if (window.electronAPI && window.electronAPI.getRecentProjects) {
        const recentProjects = await window.electronAPI.getRecentProjects();
        
        if (recentProjects.length === 0) {
          recentProjectsContainer.innerHTML = `
            <div class="text-center text-muted-dark py-8">
              <span class="material-symbols-outlined text-4xl mb-2">folder_off</span>
              <p>Nenhum projeto recente encontrado.</p>
            </div>
          `;
          return;
        }

        recentProjectsContainer.innerHTML = recentProjects.map(project => `
          <div class="flex items-center justify-between bg-surface-dark p-4 rounded-lg hover:bg-gray-800 cursor-pointer recent-project-item" data-project-id="${project.id}">
            <div class="flex items-center gap-4">
              <span class="material-symbols-outlined text-muted-dark">description</span>
              <div>
                <p class="font-semibold text-text-dark">${project.projectName}</p>
                <p class="text-sm text-muted-dark">${project.projectPath}${project.repoFolderName ? '/' + project.repoFolderName : ''}</p>
              </div>
            </div>
            <button class="p-2 rounded-full hover:bg-gray-700 remove-project" data-project-id="${project.id}">
              <span class="material-symbols-outlined text-muted-dark text-xl">close</span>
            </button>
          </div>
        `).join('');

        // Add click handlers for recent projects
        document.querySelectorAll('.recent-project-item').forEach(item => {
          item.addEventListener('click', (e) => {
            if (!e.target.closest('.remove-project')) {
              const projectId = item.dataset.projectId;
              openRecentProject(projectId);
            }
          });
        });

        // Add click handlers for remove buttons
        document.querySelectorAll('.remove-project').forEach(button => {
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            const projectId = button.dataset.projectId;
            removeRecentProject(projectId);
          });
        });

      } else {
        console.error('Electron API for getRecentProjects missing.');
      }
    } catch (error) {
      console.error('Error loading recent projects:', error);
      recentProjectsContainer.innerHTML = `
        <div class="text-center text-red-400 py-8">
          <p>Erro ao carregar projetos recentes.</p>
        </div>
      `;
    }
  }

  // Function to open recent project
  async function openRecentProject(projectId) {
    try {
      sessionStorage.setItem('currentProjectId', projectId);
      sessionStorage.setItem('reopenMode', 'true');
      window.electronAPI.navigateTo('create.html');
    } catch (error) {
      console.error('Error opening recent project:', error);
      alert('Erro ao abrir projeto: ' + error);
    }
  }

  // Function to remove recent project (placeholder for future implementation)
  function removeRecentProject(projectId) {
    console.log('Remove project:', projectId);
    // Future: Implement project removal from database
  }
});
