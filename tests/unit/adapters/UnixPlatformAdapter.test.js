/**
 * @vitest-environment node
 */

/**
 * Test suite for UnixPlatformAdapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnixPlatformAdapter } from '../../../src/main/adapters/UnixPlatformAdapter.js';

describe('UnixPlatformAdapter', () => {
  let adapter;
  let originalProcess;

  beforeEach(() => {
    originalProcess = global.process;
    global.process = {
      platform: 'linux',
      arch: 'x64',
      env: {
        PATH: '/usr/bin:/bin:/usr/local/bin',
        HOME: '/home/testuser',
        TMPDIR: '/tmp'
      }
    };
    adapter = new UnixPlatformAdapter();
  });

  afterEach(() => {
    global.process = originalProcess;
  });

  describe('platform detection', () => {
    it('should return correct platform', () => {
      expect(adapter.getPlatform()).toBe('linux');
    });

    it('should return correct architecture', () => {
      expect(adapter.getArchitecture()).toBe('x64');
    });

    it('should identify as Linux', () => {
      expect(adapter.isWindows()).toBe(false);
      expect(adapter.isMacOS()).toBe(false);
      expect(adapter.isLinux()).toBe(true);
    });

    it('should identify as macOS when platform is darwin', () => {
      global.process.platform = 'darwin';
      const macAdapter = new UnixPlatformAdapter();
      
      expect(macAdapter.isWindows()).toBe(false);
      expect(macAdapter.isMacOS()).toBe(true);
      expect(macAdapter.isLinux()).toBe(false);
    });
  });

  describe('executable handling', () => {
    it('should return empty extension', () => {
      expect(adapter.getExecutableExtension()).toBe('');
    });

    it('should not modify commands', () => {
      const result = adapter.getProcessCommand('node', ['--version']);
      expect(result.command).toBe('node');
      expect(result.args).toEqual(['--version']);
    });

    it('should handle commands with existing extensions', () => {
      const result = adapter.getProcessCommand('script.sh', ['run']);
      expect(result.command).toBe('script.sh');
      expect(result.args).toEqual(['run']);
    });
  });

  describe('path operations', () => {
    it('should normalize Unix paths', () => {
      expect(adapter.normalizePath('/home/user/file.txt')).toBe('/home/user/file.txt');
      expect(adapter.normalizePath('home/user/file.txt')).toBe('home/user/file.txt');
    });

    it('should join paths correctly', () => {
      expect(adapter.joinPath('/home', 'user', 'file.txt')).toBe('/home/user/file.txt');
      expect(adapter.joinPath('home', 'user', 'file.txt')).toBe('home/user/file.txt');
    });

    it('should return temp directory', () => {
      expect(adapter.getTempDirectory()).toBe('/tmp');
    });

    it('should return home directory', () => {
      expect(adapter.getHomeDirectory()).toBe('/home/testuser');
    });
  });

  describe('environment paths', () => {
    it('should return environment paths', () => {
      const paths = adapter.getEnvironmentPaths();
      expect(paths.PATH).toBe('/usr/bin:/bin:/usr/local/bin');
      expect(paths.HOME).toBe('/home/testuser');
    });

    it('should return system paths', () => {
      const paths = adapter.getSystemPaths();
      expect(paths.home).toBe('/home/testuser');
      expect(paths.temp).toBe('/tmp');
      expect(paths.path).toBe('/usr/bin:/bin:/usr/local/bin');
    });
  });

  describe('shell commands', () => {
    it('should return Unix-specific shell commands', () => {
      expect(adapter.getShellCommand('list-files')).toBe('ls -la');
      expect(adapter.getShellCommand('list-processes')).toBe('ps aux');
      expect(adapter.getShellCommand('kill-process')).toBe('kill');
      expect(adapter.getShellCommand('unknown')).toBe('unknown');
    });
  });
});