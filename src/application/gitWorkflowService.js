function createGitWorkflowService({ gitAdapter, projectService } = {}) {
  if (!gitAdapter) {
    throw new Error('gitAdapter is required');
  }

  if (!projectService) {
    throw new Error('projectService is required');
  }

  async function withProject(projectId, handler) {
    const project = await projectService.getProjectDetails(projectId);
    const repositoryPath = projectService.resolveProjectRepositoryPath(project);
    return handler(project, repositoryPath);
  }

  async function listBranches(projectId) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.listBranches(repositoryPath);
    });
  }

  async function createBranch(projectId, branchName) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.createBranch(repositoryPath, branchName);
    });
  }

  async function checkoutBranch(projectId, branchName) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.checkoutBranch(repositoryPath, branchName);
    });
  }

  async function getCurrentBranch(projectId) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.getCurrentBranch(repositoryPath);
    });
  }

  async function getRepositoryInfo(projectId) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.getRepositoryInfo(repositoryPath);
    });
  }

  async function pullFromPreview(projectId) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.pullFromPreview(repositoryPath);
    });
  }

  async function pushToBranch(projectId, targetBranch) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.pushToBranch(repositoryPath, targetBranch);
    });
  }

  async function listRemoteBranches(projectId) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.listRemoteBranches(repositoryPath);
    });
  }

  async function ensurePreviewBranch(projectId) {
    return withProject(projectId, async (_project, repositoryPath) => {
      return gitAdapter.ensurePreviewBranch(repositoryPath);
    });
  }

  return {
    listBranches,
    createBranch,
    checkoutBranch,
    getCurrentBranch,
    getRepositoryInfo,
    pullFromPreview,
    pushToBranch,
    listRemoteBranches,
    ensurePreviewBranch
  };
}

module.exports = {
  createGitWorkflowService
};
