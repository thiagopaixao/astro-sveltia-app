/**
 * @fileoverview Regression tests for i18n path resolution (Bug 1 fix)
 * Verifies getLocalesPath resolves correctly for dev vs packaged mode,
 * and specifically that packaged mode uses appPath directly (not path.dirname).
 * @author Documental Team
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('i18n path resolution (Bug 1 regression)', () => {
  let getLocalesPath;

  beforeEach(async () => {
    vi.clearAllMocks();
    const i18n = await import('../../src/ipc/i18n.js');
    getLocalesPath = i18n.getLocalesPath;
  });

  describe('getLocalesPath', () => {
    it('should use process.cwd() in dev mode (isPackaged=false)', () => {
      const result = getLocalesPath(false, '/irrelevant/app/path');

      expect(result).toContain('src/locales');
      // In dev mode, should be based on process.cwd(), not appPath
      expect(result).toBe(
        require('path').join(process.cwd(), 'src', 'locales')
      );
    });

    it('should use appPath directly in packaged mode (isPackaged=true)', () => {
      const result = getLocalesPath(true, '/app/path');

      expect(result).toBe('/app/path/src/locales');
    });

    it('should NOT use path.dirname on appPath (critical regression)', () => {
      const path = require('path');
      // If getLocalesPath used path.dirname, the result would be wrong:
      const appPath = '/tmp/build/resources/app.asar';
      const result = getLocalesPath(true, appPath);

      // CORRECT: path inside the asar
      expect(result).toBe('/tmp/build/resources/app.asar/src/locales');
      // WRONG (what path.dirname would produce): '/tmp/build/resources/src/locales'
      expect(result).not.toBe(
        path.join(path.dirname(appPath), 'src', 'locales')
      );
    });

    it('should handle asar path with nested directories', () => {
      const appPath = '/opt/documental/resources/app.asar';
      const result = getLocalesPath(true, appPath);

      expect(result).toBe('/opt/documental/resources/app.asar/src/locales');
      expect(result).toContain('app.asar/src/locales');
    });

    it('should return different paths for dev vs packaged with same appPath', () => {
      const appPath = '/my/app/path';
      const devResult = getLocalesPath(false, appPath);
      const packagedResult = getLocalesPath(true, appPath);

      expect(devResult).not.toBe(packagedResult);
      expect(packagedResult).toContain(appPath);
      expect(devResult).toContain(process.cwd());
    });

    it('should always end with src/locales', () => {
      const cases = [
        { isPackaged: false, appPath: '/any/path' },
        { isPackaged: true, appPath: '/foo/bar/app.asar' },
        { isPackaged: true, appPath: '/app' },
      ];

      for (const { isPackaged, appPath } of cases) {
        const result = getLocalesPath(isPackaged, appPath);
        expect(result.endsWith('src/locales')).toBe(true);
      }
    });
  });
});
