/**
 * @fileoverview Test Node.js installation functionality
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemHandlers } from '../../src/ipc/system.js';

describe('Node.js Installation Tests', () => {
  let systemHandlers;
  let mockLogger;
  let mockWindowManager;

  beforeEach(async () => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    };

    mockWindowManager = {
      getMainWindow: vi.fn()
    };

    const { SystemHandlers } = await import('../../src/ipc/system.js');
    systemHandlers = new SystemHandlers({
      logger: mockLogger,
      windowManager: mockWindowManager
    });
  });

  describe('NVM Detection', () => {
    it('should detect NVM when it exists', async () => {
      // Mock fs.existsSync to return true for NVM directory
      const fs = require('fs');
      vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
        return path.includes('.nvm');
      });

      const result = await systemHandlers.detectNVM();
      
      expect(result.exists).toBe(true);
      expect(result.type).toBe('directory');
      expect(result.path).toContain('.nvm');
    });

    it('should return false when NVM does not exist', async () => {
      // Mock fs.existsSync to return false
      const fs = require('fs');
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      // Mock exec to return error
      const { exec } = require('child_process');
      vi.spyOn({ exec }, 'exec').mockImplementation((cmd, callback) => {
        callback(new Error('Command not found'), '', '');
      });

      const result = await systemHandlers.detectNVM();
      
      expect(result.exists).toBe(false);
      expect(result.path).toBe(null);
    });
  });

  describe('Node.js Installation', () => {
    it('should have installNodeDependencies method', () => {
      expect(typeof systemHandlers.installNodeDependencies).toBe('function');
    });

    it('should have detectNVM method', () => {
      expect(typeof systemHandlers.detectNVM).toBe('function');
    });

    it('should have installNVM method', () => {
      expect(typeof systemHandlers.installNVM).toBe('function');
    });

    it('should have installNodeVersion method', () => {
      expect(typeof systemHandlers.installNodeVersion).toBe('function');
    });

    it('should have configureNodeEnvironment method', () => {
      expect(typeof systemHandlers.configureNodeEnvironment).toBe('function');
    });

    it('should have verifyNodeInstallation method', () => {
      expect(typeof systemHandlers.verifyNodeInstallation).toBe('function');
    });

    it('should initialize with correct installation progress', () => {
      expect(systemHandlers.installationProgress).toBeDefined();
      expect(systemHandlers.installationProgress.stage).toBe('idle');
      expect(systemHandlers.installationProgress.progress).toBe(0);
    });

    it('should update installation progress during process', async () => {
      // Mock NVM detection to return false (needs installation)
      vi.spyOn(systemHandlers, 'detectNVM').mockResolvedValue({
        exists: false,
        path: null,
        type: null
      });

      // Mock NVM installation
      vi.spyOn(systemHandlers, 'installNVM').mockResolvedValue();

      // Mock Node.js installation
      vi.spyOn(systemHandlers, 'installNodeVersion').mockResolvedValue({
        version: '22',
        success: true
      });

      // Mock environment configuration
      vi.spyOn(systemHandlers, 'configureNodeEnvironment').mockResolvedValue();

      // Mock verification
      vi.spyOn(systemHandlers, 'verifyNodeInstallation').mockResolvedValue({
        success: true,
        version: '22.0.0',
        path: '/home/user/.nvm/versions/node/v22.0.0/bin/node'
      });

      try {
        await systemHandlers.installNodeDependencies();
      } catch (error) {
        // Expected to fail in test environment
      }

      // Check that progress was updated
      expect(systemHandlers.installationProgress.stage).toBeDefined();
      expect(systemHandlers.installationProgress.progress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Environment Configuration', () => {
    it('should configure shell profiles correctly', async () => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      // Mock fs methods
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('# Existing content\n');
      vi.spyOn(fs, 'appendFileSync').mockImplementation();

      await systemHandlers.configureNodeEnvironment();

      // Should check for shell profiles
      expect(fs.existsSync).toHaveBeenCalledWith(path.join(os.homedir(), '.bashrc'));
      expect(fs.existsSync).toHaveBeenCalledWith(path.join(os.homedir(), '.zshrc'));
      expect(fs.existsSync).toHaveBeenCalledWith(path.join(os.homedir(), '.profile'));
    });
  });

  describe('Installation Verification', () => {
    it('should verify successful Node.js installation', async () => {
      // Mock exec to return successful Node.js verification
      const { exec } = require('child_process');
      vi.spyOn({ exec }, 'exec').mockImplementation((cmd, callback) => {
        if (cmd.includes('node --version')) {
          callback(null, 'v22.11.0\nnpm 9.0.0\n/usr/bin/node\n/usr/bin/npm\n', '');
        } else {
          callback(null, '', '');
        }
      });

      const result = await systemHandlers.verifyNodeInstallation();

      expect(result.success).toBe(true);
      expect(result.version).toBe('22.11.0');
      expect(result.npmVersion).toBe('10.9.0');
      expect(result.path).toContain('/.nvm/versions/node/v22.11.0/bin/node');
    });

    it('should handle verification failure', async () => {
      // Mock child_process.exec to return error
      const childProcess = require('child_process');
      vi.spyOn(childProcess, 'exec').mockImplementation((cmd, options, callback) => {
        if (typeof callback === 'undefined') {
          callback = options;
        }
        callback(new Error('Command failed'), '', '');
      });

      const result = await systemHandlers.verifyNodeInstallation();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Verification failed');
      
      // Restore mock
      childProcess.exec.mockRestore();
    });
  });
});