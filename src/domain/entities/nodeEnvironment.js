function createNodeEnvironment({
  nodePath = 'node',
  packageManager = 'npm'
} = {}) {
  if (typeof nodePath !== 'string' || nodePath.trim() === '') {
    throw new Error('Node path is required');
  }

  if (typeof packageManager !== 'string' || packageManager.trim() === '') {
    throw new Error('Package manager is required');
  }

  return {
    nodePath: nodePath.trim(),
    packageManager: packageManager.trim()
  };
}

module.exports = {
  createNodeEnvironment
};
