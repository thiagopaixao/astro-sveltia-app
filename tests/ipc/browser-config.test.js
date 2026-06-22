/**
 * @fileoverview Tests for BrowserView security config and DevTools toggle.
 *
 * These assertions verify that Electron BrowserView security settings
 * (contextIsolation, sandbox) and the permanent DevTools toggle
 * (before-input-event listener) are preserved in browser.js.
 *
 * Split from sveltia-load.regression.test.js for single-concern test files.
 *
 * @author Sisyphus
 * @since 2026-06-22
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('fs', async (importOriginal) => {
  return await importOriginal();
});

vi.mock('path', async (importOriginal) => {
  return await importOriginal();
});

import fs from 'fs';
import path from 'path';

const BROWSER_JS = path.join(__dirname, '..', '..', 'src', 'ipc', 'browser.js');

describe('BrowserView security configuration', () => {
  it('should have contextIsolation: true', () => {
    const source = fs.readFileSync(BROWSER_JS, 'utf8');
    expect(source).toContain('contextIsolation: true');
  });

  it('should have sandbox: false for preload access', () => {
    const source = fs.readFileSync(BROWSER_JS, 'utf8');
    expect(source).toContain('sandbox: false');
  });
});

describe('DevTools toggle (permanent)', () => {
  it('should have before-input-event listener', () => {
    const source = fs.readFileSync(BROWSER_JS, 'utf8');
    expect(source).toContain('before-input-event');
  });

  it('should call openDevTools and closeDevTools', () => {
    const source = fs.readFileSync(BROWSER_JS, 'utf8');
    expect(source).toContain('openDevTools');
    expect(source).toContain('closeDevTools');
  });
});
