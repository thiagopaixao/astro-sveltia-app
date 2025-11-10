/**
 * @fileoverview Tests for git IPC handlers
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHandlers } from '../../src/ipc/git.js';

// Mock dependencies
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/'))
}));

vi.mock('isomorphic-git', () => ({
  currentBranch: vi.fn(),
  listRefs: vi.fn(),
  branch: vi.fn(),
  checkout: vi.fn(),
  getConfig: vi.fn(),
  statusMatrix: vi.fn(),
  listServerRefs: vi.fn(),
  pull: vi.fn(),
  push: vi.fn()
}));

vi.mock('isomorphic-git/http/node', () => ({}));

describe('GitHandlers', () => {
  let gitHandlers;
  let mockLogger;
  let mockDatabaseManager;
  let mockDb;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    mockDb = {
      get: vi.fn()
    };

    mockDatabaseManager = {
      getDatabase: vi.fn().mockResolvedValue(mockDb)
    };

    gitHandlers = new GitHandlers({
      logger: mockLogger,
      databaseManager: mockDatabaseManager
    });

    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with dependencies', () => {
      expect(gitHandlers.logger).toBe(mockLogger);
      expect(gitHandlers.databaseManager).toBe(mockDatabaseManager);
    });
  });

  describe('getProjectPath', () => {
    it('should return project path for valid project', async () => {
      const mockProject = {
        id: 1,
        projectPath: '/base/path',
        repoFolderName: 'repo-name'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockProject);
      });

      const result = await gitHandlers.getProjectPath(1);
      
      expect(result).toBe('/base/path/repo-name');
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM projects WHERE id = ?', [1], expect.any(Function));
    });

    it('should throw error when project not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      await expect(gitHandlers.getProjectPath(999)).rejects.toThrow('Project not found');
    });

    it('should throw error when project data is invalid', async () => {
      const mockProject = {
        id: 1,
        projectPath: null,
        repoFolderName: 'repo-name'
      };

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockProject);
      });

      await expect(gitHandlers.getProjectPath(1)).rejects.toThrow('Invalid project data');
    });

    it('should throw error on database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      await expect(gitHandlers.getProjectPath(1)).rejects.toThrow('Database error');
    });
  });

  describe('gitListBranches', () => {
    it('should return branches and current branch', async () => {
      const { git } = require('isomorphic-git');
      git.currentBranch.mockResolvedValue('main');
      git.listRefs.mockResolvedValue([
        'refs/heads/main',
        'refs/heads/feature-branch',
        'refs/remotes/origin/main',
        'refs/remotes/origin/feature-branch',
        'refs/remotes/origin/HEAD'
      ]);

      const result = await gitHandlers.gitListBranches('/test/repo');
      
      expect(result).toEqual({
        branches: [
          { name: 'main', isCurrent: true, isRemote: false },
          { name: 'feature-branch', isCurrent: false, isRemote: false },
          { name: 'main', isCurrent: false, isRemote: true },
          { name: 'feature-branch', isCurrent: false, isRemote: true }
        ],
        current: 'main'
      });
    });

    it('should throw error on git operation failure', async () => {
      const { git } = require('isomorphic-git');
      git.currentBranch.mockRejectedValue(new Error('Git error'));

      await expect(gitHandlers.gitListBranches('/test/repo')).rejects.toThrow('Git error');
    });
  });

  describe('gitCreateBranch', () => {
    it('should create branch successfully', async () => {
      const { git } = require('isomorphic-git');
      git.branch.mockResolvedValue();

      await gitHandlers.gitCreateBranch('/test/repo', 'new-branch');
      
      expect(git.branch).toHaveBeenCalledWith({
        fs: expect.any(Object),
        dir: '/test/repo',
        ref: 'new-branch'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Created branch: new-branch');
    });

    it('should throw error on branch creation failure', async () => {
      const { git } = require('isomorphic-git');
      git.branch.mockRejectedValue(new Error('Branch exists'));

      await expect(gitHandlers.gitCreateBranch('/test/repo', 'existing-branch')).rejects.toThrow('Branch exists');
    });
  });

  describe('gitCheckoutBranch', () => {
    it('should checkout branch successfully', async () => {
      const { git } = require('isomorphic-git');
      git.checkout.mockResolvedValue();

      await gitHandlers.gitCheckoutBranch('/test/repo', 'target-branch');
      
      expect(git.checkout).toHaveBeenCalledWith({
        fs: expect.any(Object),
        dir: '/test/repo',
        ref: 'target-branch'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Checked out branch: target-branch');
    });

    it('should throw error on checkout failure', async () => {
      const { git } = require('isomorphic-git');
      git.checkout.mockRejectedValue(new Error('Checkout failed'));

      await expect(gitHandlers.gitCheckoutBranch('/test/repo', 'invalid-branch')).rejects.toThrow('Checkout failed');
    });
  });

  describe('gitGetCurrentBranch', () => {
    it('should return current branch name', async () => {
      const { git } = require('isomorphic-git');
      git.currentBranch.mockResolvedValue('develop');

      const result = await gitHandlers.gitGetCurrentBranch('/test/repo');
      
      expect(result).toBe('develop');
      expect(git.currentBranch).toHaveBeenCalledWith({
        fs: expect.any(Object),
        dir: '/test/repo'
      });
    });

    it('should throw error on failure', async () => {
      const { git } = require('isomorphic-git');
      git.currentBranch.mockRejectedValue(new Error('Not a git repository'));

      await expect(gitHandlers.gitGetCurrentBranch('/not/git')).rejects.toThrow('Not a git repository');
    });
  });

  describe('gitGetRepositoryInfo', () => {
    it('should return complete repository information', async () => {
      const { git } = require('isomorphic-git');
      git.currentBranch.mockResolvedValue('main');
      git.getConfig.mockResolvedValue('https://github.com/test/repo.git');
      git.statusMatrix.mockResolvedValue([
        ['file1.txt', 1, 1],
        ['file2.txt', 1, 1]
      ]);

      // Mock gitListBranches
      gitHandlers.gitListBranches = vi.fn().mockResolvedValue({
        branches: [
          { name: 'main', isCurrent: true, isRemote: false },
          { name: 'feature', isCurrent: false, isRemote: false },
          { name: 'main', isCurrent: false, isRemote: true }
        ],
        current: 'main'
      });

      const result = await gitHandlers.gitGetRepositoryInfo('/test/repo');
      
      expect(result).toEqual({
        currentBranch: 'main',
        branches: ['main', 'feature'],
        remoteBranches: ['main'],
        remoteUrl: 'https://github.com/test/repo.git',
        isClean: true,
        status: 'clean'
      });
    });

    it('should handle dirty working directory', async () => {
      const { git } = require('isomorphic-git');
      git.currentBranch.mockResolvedValue('main');
      git.getConfig.mockRejectedValue(new Error('No remote'));
      git.statusMatrix.mockResolvedValue([
        ['file1.txt', 1, 2] // Modified file
      ]);

      gitHandlers.gitListBranches = vi.fn().mockResolvedValue({
        branches: [{ name: 'main', isCurrent: true, isRemote: false }],
        current: 'main'
      });

      const result = await gitHandlers.gitGetRepositoryInfo('/test/repo');
      
      expect(result.isClean).toBe(false);
      expect(result.status).toBe('dirty');
      expect(result.remoteUrl).toBeNull();
    });
  });

  describe('gitPullFromPreview', () => {
    it('should pull from preview branch successfully', async () => {
      const { git } = require('isomorphic-git');
      git.currentBranch.mockResolvedValue('main');
      git.checkout.mockResolvedValue();
      git.pull.mockResolvedValue();

      const result = await gitHandlers.gitPullFromPreview('/test/repo');
      
      expect(result).toEqual({ pulled: true, changes: 0 });
      expect(git.checkout).toHaveBeenCalledWith({ fs: expect.any(Object), dir: '/test/repo', ref: 'preview' });
      expect(git.pull).toHaveBeenCalledWith({
        fs: expect.any(Object),
        http: expect.any(Object),
        dir: '/test/repo',
        ref: 'preview',
        singleBranch: true
      });
      expect(git.checkout).toHaveBeenLastCalledWith({ fs: expect.any(Object), dir: '/test/repo', ref: 'main' });
    });

    it('should throw error on pull failure', async () => {
      const { git } = require('isomorphic-git');
      git.currentBranch.mockResolvedValue('main');
      git.checkout.mockResolvedValue();
      git.pull.mockRejectedValue(new Error('Pull failed'));

      await expect(gitHandlers.gitPullFromPreview('/test/repo')).rejects.toThrow('Pull failed');
    });
  });

  describe('gitPushToBranch', () => {
    it('should push to branch successfully', async () => {
      const { git } = require('isomorphic-git');
      git.push.mockResolvedValue();

      const result = await gitHandlers.gitPushToBranch('/test/repo', 'feature-branch');
      
      expect(result).toEqual({ pushed: true, changes: 0 });
      expect(git.push).toHaveBeenCalledWith({
        fs: expect.any(Object),
        http: expect.any(Object),
        dir: '/test/repo',
        ref: 'feature-branch'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Pushed changes to branch: feature-branch');
    });

    it('should throw error on push failure', async () => {
      const { git } = require('isomorphic-git');
      git.push.mockRejectedValue(new Error('Push failed'));

      await expect(gitHandlers.gitPushToBranch('/test/repo', 'invalid-branch')).rejects.toThrow('Push failed');
    });
  });

  describe('gitListRemoteBranches', () => {
    it('should return remote branch names', async () => {
      const { git } = require('isomorphic-git');
      git.getConfig.mockResolvedValue('https://github.com/test/repo.git');
      git.listServerRefs.mockResolvedValue([
        { ref: 'refs/heads/main' },
        { ref: 'refs/heads/feature' },
        { ref: 'refs/heads/develop' },
        { ref: 'refs/heads/HEAD' }
      ]);

      const result = await gitHandlers.gitListRemoteBranches('/test/repo');
      
      expect(result).toEqual(['main', 'feature', 'develop']);
    });

    it('should throw error on failure', async () => {
      const { git } = require('isomorphic-git');
      git.getConfig.mockRejectedValue(new Error('No remote configured'));

      await expect(gitHandlers.gitListRemoteBranches('/test/repo')).rejects.toThrow('No remote configured');
    });
  });

  describe('registerHandlers', () => {
    it('should register all git IPC handlers', () => {
      const { ipcMain } = require('electron');
      
      gitHandlers.registerHandlers();
      
      expect(ipcMain.handle).toHaveBeenCalledWith('git:list-branches', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git:create-branch', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git:checkout-branch', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git:get-current-branch', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git:get-repository-info', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git:pull-from-preview', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git:push-to-branch', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('git:list-remote-branches', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('🔧 Registering Git operations IPC handlers');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Git operations IPC handlers registered');
    });
  });

  describe('unregisterHandlers', () => {
    it('should unregister all git IPC handlers', () => {
      const { ipcMain } = require('electron');
      
      gitHandlers.unregisterHandlers();
      
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('git:list-branches');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('git:create-branch');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('git:checkout-branch');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('git:get-current-branch');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('git:get-repository-info');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('git:pull-from-preview');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('git:push-to-branch');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('git:list-remote-branches');
      expect(mockLogger.info).toHaveBeenCalledWith('🔧 Unregistering Git operations IPC handlers');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Git operations IPC handlers unregistered');
    });
  });

  describe('IPC Handler Functions', () => {
    beforeEach(() => {
      const { ipcMain } = require('electron');
      ipcMain.handle.mockClear();
    });

    describe('git:list-branches handler', () => {
      it('should return success with branch data', async () => {
        const { ipcMain } = require('electron');
        gitHandlers.registerHandlers();
        
        const handler = ipcMain.handle.mock.calls.find(
          call => call[0] === 'git:list-branches'
        )[1];

        gitHandlers.getProjectPath = vi.fn().mockResolvedValue('/test/repo');
        gitHandlers.gitListBranches = vi.fn().mockResolvedValue({
          branches: [{ name: 'main', isCurrent: true }],
          current: 'main'
        });

        const result = await handler({}, 1);
        
        expect(result).toEqual({
          success: true,
          branches: [{ name: 'main', isCurrent: true }],
          current: 'main'
        });
      });

      it('should return error on failure', async () => {
        const { ipcMain } = require('electron');
        gitHandlers.registerHandlers();
        
        const handler = ipcMain.handle.mock.calls.find(
          call => call[0] === 'git:list-branches'
        )[1];

        gitHandlers.getProjectPath = vi.fn().mockRejectedValue(new Error('Project not found'));

        const result = await handler({}, 999);
        
        expect(result).toEqual({
          success: false,
          error: 'Project not found'
        });
      });
    });

    describe('git:create-branch handler', () => {
      it('should return success on branch creation', async () => {
        const { ipcMain } = require('electron');
        gitHandlers.registerHandlers();
        
        const handler = ipcMain.handle.mock.calls.find(
          call => call[0] === 'git:create-branch'
        )[1];

        gitHandlers.getProjectPath = vi.fn().mockResolvedValue('/test/repo');
        gitHandlers.gitCreateBranch = vi.fn().mockResolvedValue();

        const result = await handler({}, 1, 'new-branch');
        
        expect(result).toEqual({
          success: true,
          branchName: 'new-branch'
        });
      });
    });
  });
});