function assertString(value, message) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message);
  }
}

function createProject({
  id = null,
  name,
  projectPath,
  githubUrl,
  repoFolderName = null,
  createdAt = null
} = {}) {
  assertString(name, 'Project name is required');
  assertString(projectPath, 'Project path is required');
  assertString(githubUrl, 'GitHub URL is required');

  const trimmedRepoFolderName = repoFolderName && repoFolderName.trim() !== ''
    ? repoFolderName.trim()
    : null;

  return {
    id,
    name: name.trim(),
    projectPath: projectPath.trim(),
    githubUrl: githubUrl.trim(),
    repoFolderName: trimmedRepoFolderName,
    createdAt: createdAt || new Date().toISOString()
  };
}

function assignRepositoryFolder(project, repoFolderName) {
  assertString(repoFolderName, 'Repository folder name is required');

  return {
    ...project,
    repoFolderName: repoFolderName.trim()
  };
}

function hasRepositoryFolder(project) {
  return Boolean(project.repoFolderName && project.repoFolderName.trim() !== '');
}

module.exports = {
  createProject,
  assignRepositoryFolder,
  hasRepositoryFolder
};
