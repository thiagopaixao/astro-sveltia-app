function createNodeEnvironmentService({ nodeAdapter, projectService } = {}) {
  if (!nodeAdapter) {
    throw new Error('nodeAdapter is required');
  }

  if (!projectService) {
    throw new Error('projectService is required');
  }

  async function resolveProjectPath(projectId) {
    const project = await projectService.getProjectDetails(projectId);
    return projectService.resolveProjectRepositoryPath(project);
  }

  async function installDependencies(projectId, options = {}) {
    const cwd = await resolveProjectPath(projectId);
    return nodeAdapter.run('npm', ['install'], { cwd, ...options });
  }

  async function runBuild(projectId, options = {}) {
    const cwd = await resolveProjectPath(projectId);
    return nodeAdapter.run('npm', ['run', 'build'], { cwd, ...options });
  }

  function startDevServer(projectId, { script = 'dev', onStdout, onStderr, ...options } = {}) {
    return resolveProjectPath(projectId).then(cwd => {
      const child = nodeAdapter.spawn('npm', ['run', script], { cwd, ...options });

      if (child && child.stdout && typeof child.stdout.on === 'function' && typeof onStdout === 'function') {
        child.stdout.on('data', onStdout);
      }

      if (child && child.stderr && typeof child.stderr.on === 'function' && typeof onStderr === 'function') {
        child.stderr.on('data', onStderr);
      }

      return child;
    });
  }

  async function runScript(projectId, script, options = {}) {
    if (typeof script !== 'string' || script.trim() === '') {
      throw new Error('Script name is required');
    }

    const cwd = await resolveProjectPath(projectId);
    return nodeAdapter.run('npm', ['run', script.trim()], { cwd, ...options });
  }

  return {
    installDependencies,
    runBuild,
    startDevServer,
    runScript
  };
}

module.exports = {
  createNodeEnvironmentService
};
