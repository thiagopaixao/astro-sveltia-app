/**
 * @vitest-environment node
 */

/**
 * Test suite for PlatformService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformService } from '../../../src/main/services/platform/PlatformService.js';
import { WindowsPlatformAdapter } from '../../../src/main/adapters/WindowsPlatformAdapter.js';
import { UnixPlatformAdapter } from '../../../src/main/adapters/UnixPlatformAdapter.js';
import { PlatformAdapterFactory } from '../../../src/main/factories/PlatformAdapterFactory.js';

describe('PlatformService', () => {
  let platformService;
  let mockAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = {
      getPlatform: vi.fn(),
      getArchitecture: vi.fn(),
      getExecutableExtension: vi.fn(),
      getShellCommand: vi.fn(),
      getEnvironmentPaths: vi.fn(),
      getSystemPaths: vi.fn(),
      getProcessCommand: vi.fn(),
      normalizePath: vi.fn(),
      joinPath: vi.fn(),
      getTempDirectory: vi.fn(),
      getHomeDirectory: vi.fn(),
      isWindows: vi.fn(),
      isMacOS: vi.fn(),
      isLinux: vi.fn()
    };
  });

  describe('constructor', () => {
    it('should create PlatformService with default adapter', () => {
      platformService = new PlatformService();
      expect(platformService.adapter).toBeDefined();
    });

    it('should create PlatformService with custom adapter', () => {
      platformService = new PlatformService(mockAdapter);
      expect(platformService.adapter).toBe(mockAdapter);
    });
  });

  describe('platform detection methods', () => {
    beforeEach(() => {
      platformService = new PlatformService(mockAdapter);
    });

    it('should delegate getPlatform to adapter', () => {
      mockAdapter.getPlatform.mockReturnValue('win32');
      const result = platformService.getPlatform();
      expect(result).toBe('win32');
      expect(mockAdapter.getPlatform).toHaveBeenCalledTimes(1);
    });

    it('should delegate getArchitecture to adapter', () => {
      mockAdapter.getArchitecture.mockReturnValue('x64');
      const result = platformService.getArchitecture();
      expect(result).toBe('x64');
      expect(mockAdapter.getArchitecture).toHaveBeenCalledTimes(1);
    });

    it('should delegate isWindows to adapter', () => {
      mockAdapter.isWindows.mockReturnValue(true);
      const result = platformService.isWindows();
      expect(result).toBe(true);
      expect(mockAdapter.isWindows).toHaveBeenCalledTimes(1);
    });

    it('should delegate isMacOS to adapter', () => {
      mockAdapter.isMacOS.mockReturnValue(false);
      const result = platformService.isMacOS();
      expect(result).toBe(false);
      expect(mockAdapter.isMacOS).toHaveBeenCalledTimes(1);
    });

    it('should delegate isLinux to adapter', () => {
      mockAdapter.isLinux.mockReturnValue(false);
      const result = platformService.isLinux();
      expect(result).toBe(false);
      expect(mockAdapter.isLinux).toHaveBeenCalledTimes(1);
    });
  });

  describe('executable methods', () => {
    beforeEach(() => {
      platformService = new PlatformService(mockAdapter);
    });

    it('should delegate getExecutableExtension to adapter', () => {
      mockAdapter.getExecutableExtension.mockReturnValue('.exe');
      const result = platformService.getExecutableExtension();
      expect(result).toBe('.exe');
      expect(mockAdapter.getExecutableExtension).toHaveBeenCalledTimes(1);
    });

    it('should delegate getProcessCommand to adapter', () => {
      const command = 'node';
      const args = ['--version'];
      const expected = { command: 'node.exe', args: ['--version'] };
      
      mockAdapter.getProcessCommand.mockReturnValue(expected);
      const result = platformService.getProcessCommand(command, args);
      
      expect(result).toEqual(expected);
      expect(mockAdapter.getProcessCommand).toHaveBeenCalledWith(command, args);
    });
  });

  describe('path methods', () => {
    beforeEach(() => {
      platformService = new PlatformService(mockAdapter);
    });

    it('should delegate normalizePath to adapter', () => {
      const path = 'C:\\Users\\test\\file.txt';
      const expected = 'C:/Users/test/file.txt';
      
      mockAdapter.normalizePath.mockReturnValue(expected);
      const result = platformService.normalizePath(path);
      
      expect(result).toBe(expected);
      expect(mockAdapter.normalizePath).toHaveBeenCalledWith(path);
    });

    it('should delegate joinPath to adapter', () => {
      const paths = ['C:', 'Users', 'test', 'file.txt'];
      const expected = 'C:/Users/test/file.txt';
      
      mockAdapter.joinPath.mockReturnValue(expected);
      const result = platformService.joinPath(...paths);
      
      expect(result).toBe(expected);
      expect(mockAdapter.joinPath).toHaveBeenCalledWith(...paths);
    });

    it('should delegate getTempDirectory to adapter', () => {
      const expected = '/tmp';
      mockAdapter.getTempDirectory.mockReturnValue(expected);
      
      const result = platformService.getTempDirectory();
      expect(result).toBe(expected);
      expect(mockAdapter.getTempDirectory).toHaveBeenCalledTimes(1);
    });

    it('should delegate getHomeDirectory to adapter', () => {
      const expected = '/home/user';
      mockAdapter.getHomeDirectory.mockReturnValue(expected);
      
      const result = platformService.getHomeDirectory();
      expect(result).toBe(expected);
      expect(mockAdapter.getHomeDirectory).toHaveBeenCalledTimes(1);
    });
  });

  describe('environment methods', () => {
    beforeEach(() => {
      platformService = new PlatformService(mockAdapter);
    });

    it('should delegate getEnvironmentPaths to adapter', () => {
      const expected = {
        PATH: '/usr/bin:/bin',
        HOME: '/home/user'
      };
      
      mockAdapter.getEnvironmentPaths.mockReturnValue(expected);
      const result = platformService.getEnvironmentPaths();
      
      expect(result).toEqual(expected);
      expect(mockAdapter.getEnvironmentPaths).toHaveBeenCalledTimes(1);
    });

    it('should delegate getSystemPaths to adapter', () => {
      const expected = {
        programFiles: 'C:\\Program Files',
        appData: 'C:\\Users\\user\\AppData\\Roaming'
      };
      
      mockAdapter.getSystemPaths.mockReturnValue(expected);
      const result = platformService.getSystemPaths();
      
      expect(result).toEqual(expected);
      expect(mockAdapter.getSystemPaths).toHaveBeenCalledTimes(1);
    });

    it('should delegate getShellCommand to adapter', () => {
      const command = 'list-files';
      const expected = 'dir';
      
      mockAdapter.getShellCommand.mockReturnValue(expected);
      const result = platformService.getShellCommand(command);
      
      expect(result).toBe(expected);
      expect(mockAdapter.getShellCommand).toHaveBeenCalledWith(command);
    });
  });
});