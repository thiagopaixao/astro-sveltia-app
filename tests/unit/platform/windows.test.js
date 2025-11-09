/**
 * @fileoverview Tests for Windows process inspector
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { WindowsProcessInspector } from '../../../src/main/platform/windows.js';

// Mock child_process.spawn
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn()
  };
});

describe('WindowsProcessInspector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processExists', () => {
    it('should return true when process exists', async () => {
      const mockTasklist = {
        stdout: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        error: vi.fn()
      };

      spawn.mockReturnValue(mockTasklist);

      const result = await WindowsProcessInspector.processExists(1234);
      
      expect(spawn).toHaveBeenCalledWith('tasklist', ['/fi', 'PID eq 1234', '/fo', 'csv']);
      expect(result).toBe(true);
    });

    it('should return false when process does not exist', async () => {
      const mockTasklist = {
        stdout: { 
          on: vi.fn((event, callback) => {
            if (event === 'data') callback('No tasks are running');
          })
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        error: vi.fn()
      };

      spawn.mockReturnValue(mockTasklist);

      const result = await WindowsProcessInspector.processExists(1234);
      
      expect(result).toBe(false);
    });

    it('should return false when command fails', async () => {
      const mockTasklist = {
        stdout: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'error') callback(new Error('Command failed'));
        }),
        error: vi.fn()
      };

      spawn.mockReturnValue(mockTasklist);

      const result = await WindowsProcessInspector.processExists(1234);
      
      expect(result).toBe(false);
    });
  });

  describe('parseCsvLine', () => {
    it('should parse CSV line with quoted fields', () => {
      const line = '"test.exe","1234","Console","1","1,234 K","Running","N/A","command line"';
      const result = WindowsProcessInspector.parseCsvLine(line);
      
      expect(result).toEqual([
        'test.exe',
        '1234',
        'Console',
        '1',
        '1,234 K',
        'Running',
        'N/A',
        'command line'
      ]);
    });

    it('should handle empty fields', () => {
      const line = '"test.exe","1234","","1","1,234 K","","",""';
      const result = WindowsProcessInspector.parseCsvLine(line);
      
      expect(result).toEqual([
        'test.exe',
        '1234',
        '',
        '1',
        '1,234 K',
        '',
        '',
        ''
      ]);
    });
  });

  describe('parseMemory', () => {
    it('should parse memory string with commas and K', () => {
      const result = WindowsProcessInspector.parseMemory('1,234 K');
      expect(result).toBe(1234);
    });

    it('should return 0 for invalid memory string', () => {
      const result = WindowsProcessInspector.parseMemory('invalid');
      expect(result).toBe(0);
    });

    it('should handle empty string', () => {
      const result = WindowsProcessInspector.parseMemory('');
      expect(result).toBe(0);
    });
  });

  describe('killProcess', () => {
    it('should kill process successfully', async () => {
      const mockTaskkill = {
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      spawn.mockReturnValue(mockTaskkill);

      const result = await WindowsProcessInspector.killProcess(1234);
      
      expect(spawn).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/f']);
      expect(result).toBe(true);
    });

    it('should return false when kill fails', async () => {
      const mockTaskkill = {
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(1);
        })
      };

      spawn.mockReturnValue(mockTaskkill);

      const result = await WindowsProcessInspector.killProcess(1234);
      
      expect(result).toBe(false);
    });
  });
});