const PATH_SEPARATOR_REGEX = /[\\/]+/g;

function validateProjectInput({ projectName, githubUrl, projectPath } = {}) {
  if (typeof projectName !== 'string' || projectName.trim() === '') {
    throw new Error('Project name is required');
  }

  if (typeof githubUrl !== 'string' || githubUrl.trim() === '') {
    throw new Error('GitHub URL is required');
  }

  if (typeof projectPath !== 'string' || projectPath.trim() === '') {
    throw new Error('Project path is required');
  }
}

function normalizePath(pathValue) {
  if (typeof pathValue !== 'string') {
    return pathValue;
  }

  return pathValue.replace(PATH_SEPARATOR_REGEX, '/');
}

function buildRepositoryPath(project, joinFn) {
  if (!project || typeof project !== 'object') {
    throw new Error('Project is required');
  }

  const join = typeof joinFn === 'function'
    ? joinFn
    : ((base, segment) => `${base.replace(/[\\/]+$/, '')}/${segment}`);

  if (!project.repoFolderName) {
    return project.projectPath;
  }

  return join(project.projectPath, project.repoFolderName);
}

module.exports = {
  validateProjectInput,
  normalizePath,
  buildRepositoryPath
};
