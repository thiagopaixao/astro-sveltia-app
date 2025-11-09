/**
 * @fileoverview Tests for DocumentalTracker module
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocumentalTracker, appTracker } from '../../src/main/processes/documentalTracker.js';
import fs from 'fs';
import path from 'path';

// Mock fs and path modules
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn()
  };
});

vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/'))
  };
});

describe('DocumentalTracker', () => {
  let tracker;
  let mockFs;
  const testProcessesFile = path.join('/tmp', 'test-processes.json');

  beforeEach(() => {
    mockFs = vi.mocked(fs);
    vi.clearAllMocks();
    
    // Mock successful file operations by default
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation(() => {});

    tracker = new DocumentalTracker({
      processesFile: testProcessesFile,
      enablePersistence: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create tracker with default config', () => {
      const defaultTracker = new DocumentalTracker();
      expect(defaultTracker.getConfig().enablePersistence).toBe(true);
      expect(defaultTracker.getConfig().processesFile).toContain('documental-processes.json');
    });

    it('should create tracker with custom config', () => {
      const customTracker = new DocumentalTracker({
        processesFile: '/custom/path.json',
        enablePersistence: false
      });
      expect(customTracker.getConfig().processesFile).toBe('/custom/path.json');
      expect(customTracker.getConfig().enablePersistence).toBe(false);
    });
  });

  describe('loadProcesses', () => {
    it('should load processes from file when exists', () => {
      const mockProcesses = {
        '123': { pid: 123, port: 3000, projectId: 'test' }
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockProcesses));

      const loaded = tracker.loadProcesses();
      
      expect(mockFs.existsSync).toHaveBeenCalledWith(testProcessesFile);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(testProcessesFile, 'utf8');
      expect(loaded).toEqual(mockProcesses);
      expect(tracker.getAllProcesses()).toEqual(mockProcesses);
    });

    it('should return empty object when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const loaded = tracker.loadProcesses();
      
      expect(loaded).toEqual({});
      expect(tracker.getAllProcesses()).toEqual({});
    });

    it('should handle file read errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const loaded = tracker.loadProcesses();
      
      expect(loaded).toEqual({});
      expect(tracker.getAllProcesses()).toEqual({});
    });

    it('should not load when persistence is disabled', () => {
      const noPersistenceTracker = new DocumentalTracker({
        enablePersistence: false
      });

      const loaded = noPersistenceTracker.loadProcesses();
      
      expect(mockFs.existsSync).not.toHaveBeenCalled();
      expect(loaded).toEqual({});
    });
  });

  describe('addProcess', () => {
    it('should add process successfully', () => {
      const processInfo = {
        port: 3000,
        projectId: 'test-project',
        command: 'npm start',
        cwd: '/test/path'
      };

      const result = tracker.addProcess(12345, processInfo);
      
      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const process = tracker.getProcess(12345);
      expect(process).toMatchObject(processInfo);
      expect(process.pid).toBe(12345);
      expect(process.startTime).toBeGreaterThan(0);
    });

    it('should throw error when missing pid', () => {
      expect(() => {
        tracker.addProcess(null, { port: 3000 });
      }).toThrow('PID and processInfo are required');
    });

    it('should throw error when missing processInfo', () => {
      expect(() => {
        tracker.addProcess(12345, null);
      }).toThrow('PID and processInfo are required');
    });

    it('should not save when persistence is disabled', () => {
      const noPersistenceTracker = new DocumentalTracker({
        enablePersistence: false
      });

      noPersistenceTracker.addProcess(12345, { port: 3000 });
      
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('removeProcess', () => {
    beforeEach(() => {
      tracker.addProcess(12345, {
        port: 3000,
        projectId: 'test',
        command: 'npm start',
        cwd: '/test'
      });
    });

    it('should remove existing process', () => {
      const result = tracker.removeProcess(12345);
      
      expect(result).toBe(true);
      expect(tracker.hasProcess(12345)).toBe(false);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should return false for non-existing process', () => {
      const result = tracker.removeProcess(99999);
      
      expect(result).toBe(false);
    });
  });

  describe('getProcessesByProject', () => {
    beforeEach(() => {
      tracker.addProcess(12345, { port: 3000, projectId: 'project-a', command: 'npm', cwd: '/a' });
      tracker.addProcess(12346, { port: 3001, projectId: 'project-b', command: 'npm', cwd: '/b' });
      tracker.addProcess(12347, { port: 3002, projectId: 'project-a', command: 'npm', cwd: '/c' });
    });

    it('should filter processes by project ID', () => {
      const projectAProcesses = tracker.getProcessesByProject('project-a');
      
      expect(Object.keys(projectAProcesses)).toHaveLength(2);
      expect(projectAProcesses[12345].projectId).toBe('project-a');
      expect(projectAProcesses[12347].projectId).toBe('project-a');
    });

    it('should return empty object for non-existing project', () => {
      const processes = tracker.getProcessesByProject('non-existing');
      
      expect(processes).toEqual({});
    });
  });

  describe('getProcessesByPort', () => {
    beforeEach(() => {
      tracker.addProcess(12345, { port: 3000, projectId: 'project-a', command: 'npm', cwd: '/a' });
      tracker.addProcess(12346, { port: 3001, projectId: 'project-b', command: 'npm', cwd: '/b' });
      tracker.addProcess(12347, { port: 3000, projectId: 'project-c', command: 'npm', cwd: '/c' });
    });

    it('should filter processes by port', () => {
      const port3000Processes = tracker.getProcessesByPort(3000);
      
      expect(Object.keys(port3000Processes)).toHaveLength(2);
      expect(port3000Processes[12345].port).toBe(3000);
      expect(port3000Processes[12347].port).toBe(3000);
    });

    it('should return empty object for non-existing port', () => {
      const processes = tracker.getProcessesByPort(9999);
      
      expect(processes).toEqual({});
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      tracker.addProcess(12345, { port: 3000, projectId: 'test', command: 'npm', cwd: '/test' });
      tracker.addProcess(12346, { port: 3001, projectId: 'test2', command: 'npm', cwd: '/test2' });
    });

    it('should get process count', () => {
      expect(tracker.getProcessCount()).toBe(2);
    });

    it('should check if process exists', () => {
      expect(tracker.hasProcess(12345)).toBe(true);
      expect(tracker.hasProcess(99999)).toBe(false);
    });

    it('should clear all processes', () => {
      const result = tracker.clearAllProcesses();
      
      expect(result).toBe(true);
      expect(tracker.getProcessCount()).toBe(0);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('cleanupOldProcesses', () => {
    beforeEach(() => {
      const now = Date.now();
      
      tracker.addProcess(12345, { port: 3000, projectId: 'old', command: 'npm', cwd: '/old' });
      tracker.addProcess(12346, { port: 3001, projectId: 'new', command: 'npm', cwd: '/new' });
      
      // Manually set old process time
      tracker.activeProcesses[12345].startTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
    });

    it('should clean up processes older than maxAge', () => {
      const cleaned = tracker.cleanupOldProcesses(24 * 60 * 60 * 1000); // 24 hours
      
      expect(cleaned).toBe(1);
      expect(tracker.hasProcess(12345)).toBe(false);
      expect(tracker.hasProcess(12346)).toBe(true);
    });

    it('should use default maxAge when not specified', () => {
      const cleaned = tracker.cleanupOldProcesses();
      
      expect(cleaned).toBe(1);
      expect(tracker.hasProcess(12345)).toBe(false);
      expect(tracker.hasProcess(12346)).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      tracker.updateConfig({ enablePersistence: false });
      
      expect(tracker.getConfig().enablePersistence).toBe(false);
      expect(tracker.getConfig().processesFile).toBe(testProcessesFile);
    });

    it('should get configuration copy', () => {
      const config = tracker.getConfig();
      config.enablePersistence = false;
      
      expect(tracker.getConfig().enablePersistence).toBe(true);
    });
  });
});

describe('appTracker', () => {
  it('should export singleton instance', () => {
    expect(appTracker).toBeInstanceOf(DocumentalTracker);
  });

  it('should have default configuration', () => {
    const config = appTracker.getConfig();
    expect(config.enablePersistence).toBe(true);
    expect(config.processesFile).toContain('documental-processes.json');
  });
});