const { createProject, assignRepositoryFolder } = require('../domain/entities/project');
const { validateProjectInput, buildRepositoryPath } = require('../domain/rules/projectRules');

function createProjectService({ projectRepository, pathUtils } = {}) {
  if (!projectRepository) {
    throw new Error('projectRepository is required');
  }

  const joinFn = pathUtils && typeof pathUtils.join === 'function'
    ? pathUtils.join.bind(pathUtils)
    : undefined;

  async function registerProject(projectData) {
    validateProjectInput(projectData);

    const existing = await projectRepository.findByProjectPath(projectData.projectPath.trim());
    if (existing) {
      throw new Error('PROJECT_ALREADY_EXISTS');
    }

    const project = createProject({
      name: projectData.projectName,
      githubUrl: projectData.githubUrl,
      projectPath: projectData.projectPath
    });

    const savedProject = await projectRepository.save(project);
    return savedProject;
  }

  async function getProjectById(projectId) {
    if (!projectId) {
      throw new Error('Project id is required');
    }

    return projectRepository.findById(projectId);
  }

  async function getProjectDetails(projectId) {
    const project = await getProjectById(projectId);
    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }
    return project;
  }

  async function listRecentProjects(limit = 3) {
    return projectRepository.findRecent(limit);
  }

  async function listAllProjects() {
    return projectRepository.findAll();
  }

  function resolveProjectRepositoryPath(project) {
    return buildRepositoryPath(project, joinFn);
  }

  async function setRepositoryFolder(projectId, repoFolderName) {
    const project = await getProjectDetails(projectId);

    const updatedProject = assignRepositoryFolder(project, repoFolderName);

    // Ensure no other project shares the same absolute path
    const absolutePath = resolveProjectRepositoryPath(updatedProject);
    const conflicting = await findProjectByAbsolutePath(absolutePath);
    if (conflicting && conflicting.id !== projectId) {
      throw new Error('PROJECT_PATH_CONFLICT');
    }

    await projectRepository.update(updatedProject);
    return updatedProject;
  }

  async function removeProject(projectId) {
    const project = await getProjectById(projectId);
    if (!project) {
      return false;
    }

    await projectRepository.delete(projectId);
    return true;
  }

  async function findProjectByAbsolutePath(absolutePath) {
    const projects = await projectRepository.findAll();
    return projects.find(project => {
      const repositoryPath = resolveProjectRepositoryPath(project);
      return repositoryPath === absolutePath || project.projectPath === absolutePath;
    }) || null;
  }

  return {
    registerProject,
    getProjectById,
    getProjectDetails,
    listRecentProjects,
    listAllProjects,
    setRepositoryFolder,
    removeProject,
    findProjectByAbsolutePath,
    resolveProjectRepositoryPath
  };
}

module.exports = {
  createProjectService
};
