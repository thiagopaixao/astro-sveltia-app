function createGitRepository({
  remoteUrl = null,
  currentBranch = null,
  branches = []
} = {}) {
  return {
    remoteUrl,
    currentBranch,
    branches: Array.isArray(branches) ? [...branches] : []
  };
}

function updateCurrentBranch(repository, branchName) {
  if (typeof branchName !== 'string' || branchName.trim() === '') {
    throw new Error('Branch name is required');
  }

  return {
    ...repository,
    currentBranch: branchName.trim()
  };
}

function addBranch(repository, branchName) {
  if (typeof branchName !== 'string' || branchName.trim() === '') {
    throw new Error('Branch name is required');
  }

  const normalized = branchName.trim();
  const branches = new Set(repository.branches || []);
  branches.add(normalized);

  return {
    ...repository,
    branches: [...branches]
  };
}

module.exports = {
  createGitRepository,
  updateCurrentBranch,
  addBranch
};
