/**
 * @vitest-environment node
 */

/**
 * Test suite for WindowsPlatformAdapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowsPlatformAdapter } from '../../../src/main/adapters/WindowsPlatformAdapter.js';

describe('WindowsPlatformAdapter', () => {
  let adapter;
  let originalProcess;

  beforeEach(() => {
    originalProcess = global.process;
    global.process = {
      platform: 'win32',
      arch: 'x64',
      env: {
        PATH: 'C:\\Windows\\system32;C:\\Program Files\\nodejs',
        USERPROFILE: 'C:\\Users\\testuser',
        APPDATA: 'C:\\Users\\testuser\\AppData\\Roaming',
        LOCALAPPDATA: 'C:\\Users\\testuser\\AppData\\Local',
        TEMP: 'C:\\Users\\testuser\\AppData\\Local\\Temp'
      }
    };
    adapter = new WindowsPlatformAdapter();
  });

  afterEach(() => {
    global.process = originalProcess;
  });

  describe('platform detection', () => {
    it('should return correct platform', () => {
      expect(adapter.getPlatform()).toBe('win32');
    });

    it('should return correct architecture', () => {
      expect(adapter.getArchitecture()).toBe('x64');
    });

    it('should identify as Windows', () => {
      expect(adapter.isWindows()).toBe(true);
      expect(adapter.isMacOS()).toBe(false);
      expect(adapter.isLinux()).toBe(false);
    });
  });

  describe('executable handling', () => {
    it('should return .exe extension', () => {
      expect(adapter.getExecutableExtension()).toBe('.exe');
    });

    it('should add .exe extension to commands without extension', () => {
      const result = adapter.getProcessCommand('node', ['--version']);
      expect(result.command).toBe('node.exe');
      expect(result.args).toEqual(['--version']);
    });

    it('should not modify commands that already have .exe', () => {
      const result = adapter.getProcessCommand('git.exe', ['status']);
      expect(result.command).toBe('git.exe');
      expect(result.args).toEqual(['status']);
    });

    it('should not modify commands with other extensions', () => {
      const result = adapter.getProcessCommand('script.bat', ['run']);
      expect(result.command).toBe('script.bat');
      expect(result.args).toEqual(['run']);
    });
  });

  describe('path operations', () => {
    it('should normalize Windows paths', () => {
      expect(adapter.normalizePath('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt');
      expect(adapter.normalizePath('C:/Users\\test/file.txt')).toBe('C:/Users/test/file.txt');
    });

    it('should join paths correctly', () => {
      expect(adapter.joinPath('C:', 'Users', 'test', 'file.txt')).toBe('C:/Users/test/file.txt');
      expect(adapter.joinPath('C:\\Users', 'test', 'file.txt')).toBe('C:/Users/test/file.txt');
    });

    it('should return temp directory', () => {
      expect(adapter.getTempDirectory()).toBe('C:/Users/testuser/AppData/Local/Temp');
    });

    it('should return home directory', () => {
      expect(adapter.getHomeDirectory()).toBe('C:/Users/testuser');
    });
  });

  describe('environment paths', () => {
    it('should return environment paths', () => {
      const paths = adapter.getEnvironmentPaths();
      expect(paths.PATH).toBe('C:\\Windows\\system32;C:\\Program Files\\nodejs');
      expect(paths.HOME).toBe('C:\\Users\\testuser');
    });

    it('should return system paths', () => {
      const paths = adapter.getSystemPaths();
      expect(paths.programFiles).toBeDefined();
      expect(paths.appData).toBe('C:\\Users\\testuser\\AppData\\Roaming');
      expect(paths.localAppData).toBe('C:\\Users\\testuser\\AppData\\Local');
      expect(paths.temp).toBe('C:\\Users\\testuser\\AppData\\Local\\Temp');
    });
  });

  describe('shell commands', () => {
    it('should return Windows-specific shell commands', () => {
      expect(adapter.getShellCommand('list-files')).toBe('dir');
      expect(adapter.getShellCommand('list-processes')).toBe('tasklist');
      expect(adapter.getShellCommand('kill-process')).toBe('taskkill');
      expect(adapter.getShellCommand('unknown')).toBe('unknown');
    });
  });
});