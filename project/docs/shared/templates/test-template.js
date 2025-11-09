/**
 * @fileoverview Template for test files using Vitest and ESM
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModuleTemplate } from '../src/main/module-template.js';

// Mock dependencies
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
    getVersion: vi.fn(),
    quit: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}));

describe('ModuleTemplate', () => {
  let moduleTemplate;

  beforeEach(() => {
    moduleTemplate = new ModuleTemplate({
      name: 'test-module',
      options: { debug: true }
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (moduleTemplate && moduleTemplate.initialized) {
      return moduleTemplate.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const instance = new ModuleTemplate();
      expect(instance.config.name).toBe('module-template');
      expect(instance.initialized).toBe(false);
    });

    it('should create instance with custom config', () => {
      const config = { name: 'custom-module', options: { debug: false } };
      const instance = new ModuleTemplate(config);
      expect(instance.config.name).toBe('custom-module');
      expect(instance.config.options.debug).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(moduleTemplate.initialize()).resolves.not.toThrow();
      expect(moduleTemplate.initialized).toBe(true);
    });

    it('should throw error if already initialized', async () => {
      await moduleTemplate.initialize();
      await expect(moduleTemplate.initialize()).rejects.toThrow('Module already initialized');
    });

    it('should emit initialized event', async () => {
      const spy = vi.fn();
      moduleTemplate.on('initialized', spy);
      await moduleTemplate.initialize();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', async () => {
      await moduleTemplate.initialize();
      await expect(moduleTemplate.cleanup()).resolves.not.toThrow();
      expect(moduleTemplate.initialized).toBe(false);
    });

    it('should handle cleanup when not initialized', async () => {
      await expect(moduleTemplate.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return correct status', () => {
      const status = moduleTemplate.getStatus();
      expect(status).toHaveProperty('name');
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('config');
      expect(status.initialized).toBe(false);
    });
  });
});