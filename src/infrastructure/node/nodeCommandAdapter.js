function createNodeCommandAdapter({ spawn } = {}) {
  if (typeof spawn !== 'function') {
    throw new Error('spawn function is required');
  }

  function run(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, options);
      let stdout = '';
      let stderr = '';

      if (child.stdout && typeof child.stdout.on === 'function') {
        child.stdout.on('data', data => {
          stdout += data.toString();
          if (typeof options.onStdout === 'function') {
            options.onStdout(data);
          }
        });
      }

      if (child.stderr && typeof child.stderr.on === 'function') {
        child.stderr.on('data', data => {
          stderr += data.toString();
          if (typeof options.onStderr === 'function') {
            options.onStderr(data);
          }
        });
      }

      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) {
          resolve({ code, stdout, stderr });
        } else {
          const error = new Error(`Command failed with exit code ${code}`);
          error.code = code;
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        }
      });
    });
  }

  function spawnProcess(command, args = [], options = {}) {
    return spawn(command, args, options);
  }

  return {
    run,
    spawn: spawnProcess
  };
}

module.exports = {
  createNodeCommandAdapter
};
