const { describe, it, expect, beforeEach, vi } = require('vitest');
const { createGitWorkflowService } = require('../../src/application/gitWorkflowService');
const { createProject } = require('../../src/domain/entities/project');

describe('GitWorkflowService', () => {
  let gitAdapter;
  let projectService;
  let service;

  beforeEach(() => {
    gitAdapter = {
      listBranches: vi.fn(async () => ({ branches: ['main'], currentBranch: 'main' })),
      createBranch: vi.fn(async () => true),
      checkoutBranch: vi.fn(async () => true),
      getCurrentBranch: vi.fn(async () => 'main'),
      getRepositoryInfo: vi.fn(async () => ({ remoteUrl: 'git@github.com:org/repo.git' })),
      pullFromPreview: vi.fn(async () => ({ success: true })),
      pushToBranch: vi.fn(async () => ({ success: true })),
      listRemoteBranches: vi.fn(async () => ['preview', 'main']),
      ensurePreviewBranch: vi.fn(async () => ({ created: false }))
    };

    const project = createProject({
      id: 1,
      name: 'Alpha',
      projectPath: '/projects/alpha',
      githubUrl: 'https://github.com/org/alpha',
      repoFolderName: 'alpha'
    });

    projectService = {
      getProjectDetails: vi.fn(async () => project),
      resolveProjectRepositoryPath: vi.fn(() => '/projects/alpha/alpha')
    };

    service = createGitWorkflowService({ gitAdapter, projectService });
  });

  it('delegates branch listing to the git adapter', async () => {
    const result = await service.listBranches(1);
    expect(result.currentBranch).toBe('main');
    expect(gitAdapter.listBranches).toHaveBeenCalledWith('/projects/alpha/alpha');
  });

  it('creates branches on the git adapter', async () => {
    await service.createBranch(1, 'feature/alpha');
    expect(gitAdapter.createBranch).toHaveBeenCalledWith('/projects/alpha/alpha', 'feature/alpha');
  });

  it('checks out branches using the git adapter', async () => {
    await service.checkoutBranch(1, 'preview');
    expect(gitAdapter.checkoutBranch).toHaveBeenCalledWith('/projects/alpha/alpha', 'preview');
  });

  it('retrieves repository info from the adapter', async () => {
    await service.getRepositoryInfo(1);
    expect(gitAdapter.getRepositoryInfo).toHaveBeenCalledWith('/projects/alpha/alpha');
  });

  it('pulls from preview branch through the adapter', async () => {
    await service.pullFromPreview(1);
    expect(gitAdapter.pullFromPreview).toHaveBeenCalledWith('/projects/alpha/alpha');
  });

  it('pushes to a target branch using the adapter', async () => {
    await service.pushToBranch(1, 'preview');
    expect(gitAdapter.pushToBranch).toHaveBeenCalledWith('/projects/alpha/alpha', 'preview');
  });

  it('lists remote branches using the adapter', async () => {
    await service.listRemoteBranches(1);
    expect(gitAdapter.listRemoteBranches).toHaveBeenCalledWith('/projects/alpha/alpha');
  });

  it('ensures preview branch exists using the adapter', async () => {
    await service.ensurePreviewBranch(1);
    expect(gitAdapter.ensurePreviewBranch).toHaveBeenCalledWith('/projects/alpha/alpha');
  });
});
