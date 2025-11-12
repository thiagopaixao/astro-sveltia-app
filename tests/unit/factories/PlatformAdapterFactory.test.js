/**
 * @vitest-environment node
 */

/**
 * Test suite for PlatformAdapterFactory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformAdapterFactory } from '../../../src/main/factories/PlatformAdapterFactory.js';
import { WindowsPlatformAdapter } from '../../../src/main/adapters/WindowsPlatformAdapter.js';
import { UnixPlatformAdapter } from '../../../src/main/adapters/UnixPlatformAdapter.js';
const UnixAdapter = UnixPlatformAdapter;

describe('PlatformAdapterFactory', () => {
  let originalProcess;

  beforeEach(() => {
    originalProcess = global.process;
  });

  afterEach(() => {
    global.process = originalProcess;
  });

  describe('createAdapter', () => {
    it('should create Windows adapter for win32 platform', () => {
      global.process = { platform: 'win32' };
      const adapter = PlatformAdapterFactory.createAdapter();
      
      expect(adapter.constructor.name).toBe('WindowsPlatformAdapter');
    });

    it('should create Unix adapter for linux platform', () => {
      global.process = { platform: 'linux' };
      const adapter = PlatformAdapterFactory.createAdapter();
      
      expect(adapter.constructor.name).toBe('UnixPlatformAdapter');
    });

    it('should create Unix adapter for darwin platform', () => {
      global.process = { platform: 'darwin' };
      const adapter = PlatformAdapterFactory.createAdapter();
      
      expect(adapter.constructor.name).toBe('UnixPlatformAdapter');
    });

    it('should create Unix adapter for freebsd platform', () => {
      global.process = { platform: 'freebsd' };
      const adapter = PlatformAdapterFactory.createAdapter();
      
      expect(adapter.constructor.name).toBe('UnixPlatformAdapter');
    });

    it('should create Unix adapter for unknown platforms', () => {
      global.process = { platform: 'unknown' };
      const adapter = PlatformAdapterFactory.createAdapter();
      
      expect(adapter.constructor.name).toBe('UnixPlatformAdapter');
    });

    it('should cache adapter instances', () => {
      global.process = { platform: 'win32' };
      
      const adapter1 = PlatformAdapterFactory.createAdapter();
      const adapter2 = PlatformAdapterFactory.createAdapter();
      
      expect(adapter1).toBe(adapter2);
    });

    it('should create separate instances for different platforms', () => {
      // First call with Windows
      global.process = { platform: 'win32' };
      const windowsAdapter = PlatformAdapterFactory.createAdapter();
      
      // Second call with Linux
      global.process = { platform: 'linux' };
      const linuxAdapter = PlatformAdapterFactory.createAdapter();
      
      expect(windowsAdapter.constructor.name).toBe('WindowsPlatformAdapter');
      expect(linuxAdapter.constructor.name).toBe('UnixPlatformAdapter');
      expect(windowsAdapter).not.toBe(linuxAdapter);
    });
  });

  describe('clearCache', () => {
    it('should clear cached adapter', () => {
      global.process = { platform: 'win32' };
      
      const adapter1 = PlatformAdapterFactory.createAdapter();
      PlatformAdapterFactory.clearCache();
      const adapter2 = PlatformAdapterFactory.createAdapter();
      
      expect(adapter1).not.toBe(adapter2);
      expect(adapter1.constructor.name).toBe('WindowsPlatformAdapter');
      expect(adapter2.constructor.name).toBe('WindowsPlatformAdapter');
    });
  });

  describe('getPlatformType', () => {
    it('should return windows for win32', () => {
      expect(PlatformAdapterFactory.getPlatformType('win32')).toBe('windows');
    });

    it('should return unix for linux', () => {
      expect(PlatformAdapterFactory.getPlatformType('linux')).toBe('unix');
    });

    it('should return unix for darwin', () => {
      expect(PlatformAdapterFactory.getPlatformType('darwin')).toBe('unix');
    });

    it('should return unix for freebsd', () => {
      expect(PlatformAdapterFactory.getPlatformType('freebsd')).toBe('unix');
    });

    it('should return unix for unknown platforms', () => {
      expect(PlatformAdapterFactory.getPlatformType('unknown')).toBe('unix');
    });
  });
});