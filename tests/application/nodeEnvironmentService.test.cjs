const { describe, it, expect, beforeEach, vi } = require('vitest');
const { createNodeEnvironmentService } = require('../../src/application/nodeEnvironmentService');
const { createProject } = require('../../src/domain/entities/project');

describe('NodeEnvironmentService', () => {
  let nodeAdapter;
  let projectService;
  let service;

  beforeEach(() => {
    nodeAdapter = {
      run: vi.fn(async () => ({ code: 0 })),
      spawn: vi.fn(() => ({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() }
      }))
    };

    const project = createProject({
      id: 7,
      name: 'Gamma',
      projectPath: '/projects/gamma',
      githubUrl: 'https://github.com/org/gamma',
      repoFolderName: 'app'
    });

    projectService = {
      getProjectDetails: vi.fn(async () => project),
      resolveProjectRepositoryPath: vi.fn(() => '/projects/gamma/app')
    };

    service = createNodeEnvironmentService({ nodeAdapter, projectService });
  });

  it('installs dependencies using the node adapter', async () => {
    await service.installDependencies(7);
    expect(nodeAdapter.run).toHaveBeenCalledWith('npm', ['install'], expect.objectContaining({ cwd: '/projects/gamma/app' }));
  });

  it('runs build scripts using the node adapter', async () => {
    await service.runBuild(7);
    expect(nodeAdapter.run).toHaveBeenCalledWith('npm', ['run', 'build'], expect.objectContaining({ cwd: '/projects/gamma/app' }));
  });

  it('spawns a dev server process using the node adapter', async () => {
    const child = await service.startDevServer(7, { script: 'dev', onStdout: vi.fn(), onStderr: vi.fn() });
    expect(nodeAdapter.spawn).toHaveBeenCalledWith('npm', ['run', 'dev'], expect.objectContaining({ cwd: '/projects/gamma/app' }));
    expect(child).toBeDefined();
  });

  it('runs arbitrary scripts via npm', async () => {
    await service.runScript(7, 'lint');
    expect(nodeAdapter.run).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.objectContaining({ cwd: '/projects/gamma/app' }));
  });
});
