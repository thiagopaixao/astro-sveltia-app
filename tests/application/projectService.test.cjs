const { describe, it, expect, beforeEach, vi } = require('vitest');
const path = require('path');
const { createProjectService } = require('../../src/application/projectService');
const { createProject } = require('../../src/domain/entities/project');

describe('ProjectService', () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = {
      save: vi.fn(async project => ({ ...project, id: 10 })),
      update: vi.fn(async project => project),
      delete: vi.fn(async () => undefined),
      findById: vi.fn(async id => (id === 10 ? createProject({
        id: 10,
        name: 'Alpha',
        projectPath: '/projects/alpha',
        githubUrl: 'https://github.com/org/alpha',
        repoFolderName: 'alpha'
      }) : null)),
      findRecent: vi.fn(async limit => Array.from({ length: limit }, (_, index) => createProject({
        id: index + 1,
        name: `Project-${index}`,
        projectPath: `/projects/${index}`,
        githubUrl: 'https://example.com/repo'
      }))),
      findAll: vi.fn(async () => [
        createProject({
          id: 10,
          name: 'Alpha',
          projectPath: '/projects/alpha',
          githubUrl: 'https://github.com/org/alpha',
          repoFolderName: 'alpha'
        }),
        createProject({
          id: 20,
          name: 'Beta',
          projectPath: '/projects/beta',
          githubUrl: 'https://github.com/org/beta'
        })
      ]),
      findByProjectPath: vi.fn(async projectPath => {
        if (projectPath === '/projects/existing') {
          return createProject({
            id: 99,
            name: 'Existing',
            projectPath,
            githubUrl: 'https://github.com/org/existing'
          });
        }
        return null;
      })
    };

    service = createProjectService({ projectRepository: repository, pathUtils: path });
  });

  it('registers a new project when no conflict exists', async () => {
    const project = await service.registerProject({
      projectName: 'New Project',
      githubUrl: 'https://github.com/org/new',
      projectPath: '/projects/new'
    });

    expect(repository.save).toHaveBeenCalled();
    expect(project.id).toBe(10);
  });

  it('prevents registering projects with duplicate paths', async () => {
    await expect(service.registerProject({
      projectName: 'Existing',
      githubUrl: 'https://github.com/org/existing',
      projectPath: '/projects/existing'
    })).rejects.toThrow('PROJECT_ALREADY_EXISTS');
  });

  it('calculates the repository path for a project', async () => {
    const project = await service.getProjectDetails(10);
    const repoPath = service.resolveProjectRepositoryPath(project);

    expect(repoPath).toBe(path.join('/projects/alpha', 'alpha'));
  });

  it('updates the repository folder ensuring no conflicts', async () => {
    repository.findAll.mockResolvedValueOnce([
      createProject({
        id: 10,
        name: 'Alpha',
        projectPath: '/projects/alpha',
        githubUrl: 'https://github.com/org/alpha'
      })
    ]);

    const updated = await service.setRepositoryFolder(10, 'alpha');
    expect(updated.repoFolderName).toBe('alpha');
    expect(repository.update).toHaveBeenCalled();
  });

  it('finds a project by its absolute path', async () => {
    const project = await service.findProjectByAbsolutePath(path.join('/projects/alpha', 'alpha'));
    expect(project).toBeDefined();
    expect(project.name).toBe('Alpha');
  });

  it('removes a project when it exists', async () => {
    const removed = await service.removeProject(10);
    expect(removed).toBe(true);
    expect(repository.delete).toHaveBeenCalledWith(10);
  });

  it('list recent projects honoring the provided limit', async () => {
    const projects = await service.listRecentProjects(2);
    expect(projects).toHaveLength(2);
    expect(repository.findRecent).toHaveBeenCalledWith(2);
  });
});
