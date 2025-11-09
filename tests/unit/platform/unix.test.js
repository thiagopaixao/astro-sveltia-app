/**
 * @fileoverview Tests for Unix process inspector
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import { UnixProcessInspector } from '../../../src/main/platform/unix.js';

// Mock child_process.spawn
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn()
  };
});

// Mock fs
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    constants: {
      F_OK: 0
    },
    access: vi.fn(),
    promises: {
      readFile: vi.fn(),
      readlink: vi.fn()
    }
  };
});

describe('UnixProcessInspector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.platform mock
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processExists on Linux', () => {
    it('should return true when process exists via /proc', async () => {
      fs.access.mockImplementation((path, mode, callback) => {
        callback(null); // File exists
      });

      const result = await UnixProcessInspector.processExists(1234);
      
      expect(fs.access).toHaveBeenCalledWith('/proc/1234/status', fs.constants.F_OK, expect.any(Function));
      expect(result).toBe(true);
    });

    it('should return false when process does not exist via /proc', async () => {
      fs.access.mockImplementation((path, mode, callback) => {
        callback(new Error('File not found'));
      });

      const result = await UnixProcessInspector.processExists(1234);
      
      expect(result).toBe(false);
    });
  });

  describe('processExists on non-Linux', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });
    });

    it('should use ps command on non-Linux systems', async () => {
      const mockPs = {
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      spawn.mockReturnValue(mockPs);

      const result = await UnixProcessInspector.processExists(1234);
      
      expect(spawn).toHaveBeenCalledWith('ps', ['-p', '1234']);
      expect(result).toBe(true);
    });
  });

  describe('getLinuxProcessInfo', () => {
    it('should read process info from /proc filesystem', async () => {
      const mockStatusData = `Name:	test
State:	S (sleeping)
VmRSS:	 1234 kB`;
      
      const mockCmdlineData = 'node\x00app.js\x00--port\x003000\x00';
      const mockStatData = '1234 (test) S 1233 1234 1234 0 -1 4194560 123 0 0 0 0 0 0 0 20 0 1 0 12345678 12345678 12345678 12345678 12345678 12345678 12345678 12345678 0 0 0 0 0 0 0 0 0 0 0';
      const mockCwdLink = '/home/user/project';

      fs.promises.readFile
        .mockResolvedValueOnce(mockStatusData)
        .mockResolvedValueOnce(mockCmdlineData)
        .mockResolvedValueOnce(mockStatData);
      
      fs.promises.readlink.mockResolvedValue(mockCwdLink);

      const result = await UnixProcessInspector.getLinuxProcessInfo(1234);
      
      expect(result).toEqual({
        pid: 1234,
        name: 'test',
        command: 'node app.js --port 3000',
        memory: 1234,
        status: 'S (sleeping)',
        cwd: '/home/user/project'
      });
    });

    it('should handle missing /proc files', async () => {
      fs.promises.readFile.mockRejectedValue(new Error('File not found'));

      await expect(UnixProcessInspector.getLinuxProcessInfo(9999)).rejects.toThrow();
    });
  });

  describe('getUnixProcessInfo', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });
    });

    it('should parse ps output correctly', async () => {
      const mockPs = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('  PID COMMAND           COMMAND           RSS S CWD\n1234 test              command line      1234 S /path/to/dir\n');
            }
          })
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      spawn.mockReturnValue(mockPs);

      const result = await UnixProcessInspector.getUnixProcessInfo(1234);
      
      expect(result).toEqual({
        pid: 1234,
        name: 'test',
        command: 'command line',
        memory: 1234,
        status: 'S',
        cwd: '/path/to/dir'
      });
    });
  });

  describe('killProcess', () => {
    it('should kill process successfully', async () => {
      const mockKill = {
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      spawn.mockReturnValue(mockKill);

      const result = await UnixProcessInspector.killProcess(1234);
      
      expect(spawn).toHaveBeenCalledWith('kill', ['-9', '1234']);
      expect(result).toBe(true);
    });

    it('should return false when kill fails', async () => {
      const mockKill = {
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(1);
        })
      };

      spawn.mockReturnValue(mockKill);

      const result = await UnixProcessInspector.killProcess(1234);
      
      expect(result).toBe(false);
    });
  });

  describe('getProcessesByName', () => {
    it('should filter processes by name pattern', async () => {
      const mockPs = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('  PID COMMAND           COMMAND           RSS S CWD\n1234 node             node app.js       1234 S /path\n5678 test             test command      5678 S /other\n');
            }
          })
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };

      spawn.mockReturnValue(mockPs);

      const result = await UnixProcessInspector.getProcessesByName('node*');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('node');
      expect(result[0].pid).toBe(1234);
    });
  });
});