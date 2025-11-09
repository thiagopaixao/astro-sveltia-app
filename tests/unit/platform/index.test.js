/**
 * @fileoverview Tests for platform factory
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessInspectorFactory } from '../../../src/main/platform/index.js';

describe('ProcessInspectorFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInspector', () => {
    it('should return WindowsProcessInspector on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const inspector = ProcessInspectorFactory.getInspector();
      
      expect(inspector).toBeDefined();
      expect(inspector.name).toContain('Windows');
    });

    it('should return UnixProcessInspector on Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const inspector = ProcessInspectorFactory.getInspector();
      
      expect(inspector).toBeDefined();
      expect(inspector.name).toContain('Unix');
    });

    it('should return UnixProcessInspector on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      const inspector = ProcessInspectorFactory.getInspector();
      
      expect(inspector).toBeDefined();
      expect(inspector.name).toContain('Unix');
    });

    it('should return UnixProcessInspector on FreeBSD', () => {
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        writable: true
      });

      const inspector = ProcessInspectorFactory.getInspector();
      
      expect(inspector).toBeDefined();
      expect(inspector.name).toContain('Unix');
    });

    it('should throw error on unsupported platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'unknown',
        writable: true
      });

      expect(() => ProcessInspectorFactory.getInspector()).toThrow('Unsupported platform: unknown');
    });
  });

  describe('Platform detection methods', () => {
    it('should correctly identify Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      expect(ProcessInspectorFactory.isWindows()).toBe(true);
      expect(ProcessInspectorFactory.isUnix()).toBe(false);
      expect(ProcessInspectorFactory.isMacOS()).toBe(false);
      expect(ProcessInspectorFactory.isLinux()).toBe(false);
    });

    it('should correctly identify Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      expect(ProcessInspectorFactory.isWindows()).toBe(false);
      expect(ProcessInspectorFactory.isUnix()).toBe(true);
      expect(ProcessInspectorFactory.isMacOS()).toBe(false);
      expect(ProcessInspectorFactory.isLinux()).toBe(true);
    });

    it('should correctly identify macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      expect(ProcessInspectorFactory.isWindows()).toBe(false);
      expect(ProcessInspectorFactory.isUnix()).toBe(true);
      expect(ProcessInspectorFactory.isMacOS()).toBe(true);
      expect(ProcessInspectorFactory.isLinux()).toBe(false);
    });

    it('should correctly identify other Unix systems', () => {
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        writable: true
      });

      expect(ProcessInspectorFactory.isWindows()).toBe(false);
      expect(ProcessInspectorFactory.isUnix()).toBe(true);
      expect(ProcessInspectorFactory.isMacOS()).toBe(false);
      expect(ProcessInspectorFactory.isLinux()).toBe(false);
    });
  });

  describe('getPlatformName', () => {
    it('should return current platform name', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      expect(ProcessInspectorFactory.getPlatformName()).toBe('linux');
    });
  });
});