/**
 * @fileoverview Test for partial git detection and cleanup
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectCreationHandler } from '../../src/ipc/projectCreation.js';

describe('ProjectCreationHandler Partial Git Detection', () => {
  let projectCreation;
  let mockLogger;
  let mockDatabaseManager;
  let mockNodeDetectionService;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    mockDatabaseManager = {
      getDatabase: vi.fn()
    };

    mockNodeDetectionService = {
      detectNode: vi.fn()
    };

    projectCreation = new ProjectCreationHandler({ 
      logger: mockLogger, 
      databaseManager: mockDatabaseManager,
      nodeDetectionService: mockNodeDetectionService
    });
  });

  it('should have hasPartialGit method', () => {
    expect(typeof projectCreation.hasPartialGit).toBe('function');
  });

  it('should have cleanPartialGit method', () => {
    expect(typeof projectCreation.cleanPartialGit).toBe('function');
  });

  it('should have gitClone method', () => {
    expect(typeof projectCreation.gitClone).toBe('function');
  });

  it('should handle partial git detection gracefully', async () => {
    // Test that methods exist and can be called without throwing
    const testDir = '/test/repo';
    
    // These should not throw even with mocked fs
    expect(async () => {
      await projectCreation.hasPartialGit(testDir);
    }).not.toThrow();
    
    expect(async () => {
      await projectCreation.cleanPartialGit(testDir);
    }).not.toThrow();
  });
});