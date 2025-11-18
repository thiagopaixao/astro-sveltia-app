document.addEventListener('DOMContentLoaded', async () => {
  const navigateButtons = document.querySelectorAll('[data-navigate]');
  const projectPathInput = document.getElementById('project-path');
  const selectFolderButton = document.getElementById('select-folder-button');
  const createProjectButton = document.getElementById('create-project-button');
  const projectNameInput = document.getElementById('project-name');
  const githubUrlInput = document.getElementById('github-url');

  // Cross-platform path utility functions
  const PathUtils = {
    join: async (...segments) => {
      if (window.electronAPI && window.electronAPI.joinPath) {
        return await window.electronAPI.joinPath(...segments);
      }
      // Fallback for development/testing
      return segments.join('/').replace(/\/+/g, '/');
    },
    
    normalize: async (filePath) => {
      if (window.electronAPI && window.electronAPI.normalizePath) {
        return await window.electronAPI.normalizePath(filePath);
      }
      // Fallback for development/testing
      return filePath.replace(/\\/g, '/');
    }
  };

  // Load recent projects
  await loadRecentProjects();
  
  // Load all projects if on all-projects page
  await loadAllProjects();
  
  // Handle open folder button
  const openFolderButton = document.getElementById('open-folder-button');
  if (openFolderButton) {
    openFolderButton.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.openDirectoryDialog) {
        const selectedPath = await window.electronAPI.openDirectoryDialog();
        if (selectedPath) {
          await handleFolderSelection(selectedPath);
        }
      }
    });
  }
  
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

  // Set default project path only if empty and we're on the new project page
  const isNewProjectPage = window.location.pathname.includes('new.html') || window.location.href.includes('new.html');
  
  if (isNewProjectPage) {
    // Wait a bit for DOM to be fully ready
    setTimeout(async () => {
      // Re-get the element to make sure it exists
      const projectPathInputRetry = document.getElementById('project-path');
      
      if (window.electronAPI && window.electronAPI.getHomeDirectory && projectPathInputRetry) {
        if (!projectPathInputRetry.value) {
          try {
            const homeDir = await window.electronAPI.getHomeDirectory();
            const defaultPath = await PathUtils.join(homeDir, 'Workspaces');
            const normalizedPath = await PathUtils.normalize(defaultPath);
            projectPathInputRetry.value = normalizedPath;
          } catch (error) {
            console.error('Error setting default project path:', error);
          }
        }
      }
    }, 100); // Small delay to ensure DOM is ready
  }

  // Handle folder selection
  if (selectFolderButton && window.electronAPI && window.electronAPI.openDirectoryDialog) {
    selectFolderButton.addEventListener('click', async () => {
      const selectedPath = await window.electronAPI.openDirectoryDialog();
      if (selectedPath && projectPathInput) {
        const normalizedPath = await PathUtils.normalize(selectedPath);
        projectPathInput.value = normalizedPath;
      }
    });
  } else {
    // Don't log error if elements don't exist (they may not be on this page)
  }

  // Handle project creation
  if (createProjectButton && window.electronAPI && window.electronAPI.saveProject) {
    createProjectButton.addEventListener('click', async () => {
      const projectName = projectNameInput ? projectNameInput.value : '';
      const githubUrl = githubUrlInput ? githubUrlInput.value : '';
      const projectPath = projectPathInput ? projectPathInput.value : '';

      if (!projectName || !githubUrl || !projectPath) {
        alert('Por favor, preencha todos os campos.');
        return;
      }

      try {
        // Check if this is an existing git repo or empty folder
        let isExistingGitRepo = false;
        let isEmptyFolder = false;
        const folderInfo = sessionStorage.getItem('folderInfo');
        if (folderInfo) {
          const info = JSON.parse(folderInfo);
          isExistingGitRepo = info.isGitRepo;
          isEmptyFolder = info.isEmpty;
        }
        
        // Normalize project path before saving
        const normalizedProjectPath = await PathUtils.normalize(projectPath);
        const projectId = await window.electronAPI.saveProject({ projectName, repoUrl: githubUrl, projectPath: normalizedProjectPath });
        sessionStorage.setItem('currentProjectId', projectId);
        sessionStorage.setItem('isExistingGitRepo', isExistingGitRepo.toString());
        sessionStorage.setItem('isEmptyFolder', isEmptyFolder.toString());
        sessionStorage.removeItem('folderInfo'); // Clean up
        window.electronAPI.navigateTo('create.html'); // Navigate to create page after creation
      } catch (error) {
        alert(`Erro ao criar projeto: ${error}`);
        console.error('Error saving project:', error);
      }
    });
  } else {
    // Don't log error if elements don't exist (they may not be on this page)
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

        recentProjectsContainer.innerHTML = await Promise.all(recentProjects.map(async (project) => {
          const fullPath = project.repoFolderName 
            ? await PathUtils.join(project.projectPath, project.repoFolderName)
            : project.projectPath;
          
          return `
            <div class="flex items-center justify-between bg-surface-dark p-4 rounded-lg hover:bg-gray-800 cursor-pointer recent-project-item" data-project-id="${project.id}">
              <div class="flex items-center gap-4">
                <span class="material-symbols-outlined text-muted-dark">description</span>
                <div>
                  <p class="font-semibold text-text-dark">${project.projectName}</p>
                  <p class="text-sm text-muted-dark">${fullPath}</p>
                </div>
              </div>
              <button class="p-2 rounded-full hover:bg-gray-700 remove-project" data-project-id="${project.id}">
                <span class="material-symbols-outlined text-muted-dark text-xl">close</span>
              </button>
            </div>
          `;
        })).then(htmlArray => htmlArray.join(''));

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
            const projectItem = button.closest('.recent-project-item');
            const projectName = projectItem.querySelector('.font-semibold').textContent;
            removeProject(projectId, projectName);
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
      window.electronAPI.navigateTo('open.html');
    } catch (error) {
      console.error('Error opening recent project:', error);
      alert('Erro ao abrir projeto: ' + error);
    }
  }

  // Function to remove project
  async function removeProject(projectId, projectName = null) {
    // Simple confirmation for now
    const confirmRemoval = confirm(`Tem certeza que deseja remover o projeto "${projectName || `Projeto #${projectId}`}"? Esta ação não pode ser desfeita.`);
    
    if (!confirmRemoval) {
      return;
    }
    
    try {
      if (window.electronAPI && window.electronAPI.removeProject) {
        await window.electronAPI.removeProject(projectId);
        
        // Reload the projects list
        await loadAllProjects();
        await loadRecentProjects(); // Also reload recent projects if on index page
        
        console.log('Project removed successfully');
      } else {
        console.error('removeProject API not available');
        alert('Erro: função de remover projeto não disponível');
      }
    } catch (error) {
      console.error('Error removing project:', error);
      alert('Erro ao remover projeto: ' + error);
    }
  }

  // Function to load all projects
  async function loadAllProjects() {
    const allProjectsContainer = document.getElementById('all-projects-container');
    const projectsCount = document.getElementById('projects-count');
    if (!allProjectsContainer) return;

    try {
      console.log('Loading all projects...');
      if (window.electronAPI && window.electronAPI.getAllProjects) {
        console.log('Calling getAllProjects API...');
        const allProjects = await window.electronAPI.getAllProjects();
        console.log('Received projects:', allProjects);
        
        if (projectsCount) {
          projectsCount.textContent = allProjects.length;
        }
        
        if (allProjects.length === 0) {
          allProjectsContainer.innerHTML = `
            <div class="text-center text-muted-dark py-8">
              <span class="material-symbols-outlined text-4xl mb-2">folder_off</span>
              <p>Nenhum projeto encontrado.</p>
            </div>
          `;
          return;
        }

        allProjectsContainer.innerHTML = await Promise.all(allProjects.map(async (project) => {
          const fullPath = project.repoFolderName 
            ? await PathUtils.join(project.projectPath, project.repoFolderName)
            : project.projectPath;
          
          return `
            <div class="flex items-center justify-between bg-gray-900/50 p-4 rounded-lg hover:bg-gray-800 cursor-pointer all-project-item" data-project-id="${project.id}">
              <div class="flex items-center gap-4">
                <span class="material-symbols-outlined text-muted-dark">description</span>
                <div>
                  <p class="font-semibold text-text-dark">${project.projectName}</p>
                  <p class="text-sm text-muted-dark">${fullPath}</p>
                  <p class="text-xs text-muted-dark mt-1">Criado em: ${new Date(project.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button class="p-2 rounded-full hover:bg-gray-700 open-project" data-project-id="${project.id}" title="Abrir projeto">
                  <span class="material-symbols-outlined text-primary text-xl">folder_open</span>
                </button>
                <button class="p-2 rounded-full hover:bg-gray-700 remove-project" data-project-id="${project.id}" title="Remover projeto">
                  <span class="material-symbols-outlined text-red-400 text-xl">delete</span>
                </button>
              </div>
            </div>
          `;
        })).then(htmlArray => htmlArray.join(''));

        // Add click handlers for all projects
        document.querySelectorAll('.all-project-item').forEach(item => {
          item.addEventListener('click', (e) => {
            if (!e.target.closest('.open-project') && !e.target.closest('.remove-project')) {
              const projectId = item.dataset.projectId;
              openRecentProject(projectId);
            }
          });
        });

        // Add click handlers for open buttons
        document.querySelectorAll('.open-project').forEach(button => {
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            const projectId = button.dataset.projectId;
            openRecentProject(projectId);
          });
        });

        // Add click handlers for remove buttons
        document.querySelectorAll('.remove-project').forEach(button => {
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            const projectId = button.dataset.projectId;
            const projectItem = button.closest('.all-project-item');
            const projectName = projectItem.querySelector('.font-semibold').textContent;
            removeProject(projectId, projectName);
          });
        });

      } else {
        console.error('Electron API for getAllProjects missing.');
        allProjectsContainer.innerHTML = `
          <div class="text-center text-red-400 py-8">
            <p>API getAllProjects não encontrada.</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading all projects:', error);
      allProjectsContainer.innerHTML = `
        <div class="text-center text-red-400 py-8">
          <p>Erro ao carregar projetos: ${error.message || error}</p>
        </div>
      `;
    }
  }

  // Function to handle folder selection
  async function handleFolderSelection(folderPath) {
    try {
      // Normalize the folder path before processing
      const normalizedPath = await PathUtils.normalize(folderPath);
      
      if (window.electronAPI && window.electronAPI.checkProjectExists) {
        const projectExists = await window.electronAPI.checkProjectExists(normalizedPath);
        
        if (projectExists.exists) {
          // Project exists, open it
          sessionStorage.setItem('currentProjectId', projectExists.projectId);
          window.electronAPI.navigateTo('open.html');
        } else {
          // Project doesn't exist, show modal
          showFolderModal(normalizedPath, projectExists.folderInfo);
        }
      }
    } catch (error) {
      console.error('Error checking folder:', error);
      alert('Erro ao verificar pasta: ' + error);
    }
  }

  // Function to show folder modal
  function showFolderModal(folderPath, folderInfo) {
    const folderModal = document.getElementById('folder-modal');
    const folderInfoDiv = document.getElementById('folder-info');
    
    folderModal.dataset.selectedPath = folderPath;
    
    let infoHTML = `<p><strong>Caminho:</strong> ${folderPath}</p>`;
    
    if (folderInfo) {
      if (folderInfo.isEmpty) {
        infoHTML += `<p><strong>Status:</strong> Pasta vazia</p>`;
        infoHTML += `<p><strong>Ação:</strong> O repositório será clonado diretamente nesta pasta</p>`;
      } else if (folderInfo.isGitRepo) {
        infoHTML += `<p><strong>Status:</strong> Repositório Git válido</p>`;
        if (folderInfo.remoteUrl) {
          infoHTML += `<p><strong>URL Remota:</strong> ${folderInfo.remoteUrl}</p>`;
        }
        infoHTML += `<p><strong>Ação:</strong> Usará repositório existente (clone ignorado)</p>`;
      } else {
        infoHTML += `<p><strong>Status:</strong> Pasta com arquivos (não é um repositório Git)</p>`;
        infoHTML += `<p><strong>Ação:</strong> Criará subpasta para o novo projeto</p>`;
      }
      infoHTML += `<p><strong>Conteúdo:</strong> ${folderInfo.fileCount || 0} arquivos/pastas</p>`;
    }
    
    folderInfoDiv.innerHTML = infoHTML;
    folderModal.style.display = 'flex';
  }

  // Handle confirm new project button
  const confirmNewProjectBtn = document.getElementById('confirm-new-project');
  if (confirmNewProjectBtn) {
    confirmNewProjectBtn.addEventListener('click', () => {
      const folderModal = document.getElementById('folder-modal');
      const selectedPath = folderModal.dataset.selectedPath;
      
      if (selectedPath) {
        sessionStorage.setItem('selectedProjectPath', selectedPath);
        sessionStorage.setItem('createFromFolder', 'true');
        window.electronAPI.navigateTo('new.html');
      }
      folderModal.style.display = 'none';
    });
  }

  // Handle cancel folder button
  const cancelFolderBtn = document.getElementById('cancel-folder');
  if (cancelFolderBtn) {
    cancelFolderBtn.addEventListener('click', () => {
      const folderModal = document.getElementById('folder-modal');
      folderModal.style.display = 'none';
    });
  }

});
