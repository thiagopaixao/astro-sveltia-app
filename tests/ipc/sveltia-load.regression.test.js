/**
 * @fileoverview Regression test for Sveltia CMS "Loading Site Data..." freeze fix.
 *
 * The freeze was caused by `base_url: https://sveltia-cms-auth.tap-647.workers.dev`
 * in config.yml. The auth worker returns HTTP 404, causing Sveltia CMS to hang
 * silently during GitHub backend initialization.
 *
 * This test overrides the global fs/path mocks from setup.js to verify real
 * config files on disk. It is a regression/integration test, not a unit test.
 *
 * BrowserView/DevTools assertions live in browser-config.test.js.
 *
 * @author Sisyphus
 * @since 2026-06-22
 */

import { describe, it, expect, vi } from 'vitest';

// Override global fs mock from setup.js — this test needs real file I/O
vi.mock('fs', async (importOriginal) => {
  return await importOriginal();
});

vi.mock('path', async (importOriginal) => {
  return await importOriginal();
});

import fs from 'fs';
import path from 'path';

const DEAD_AUTH_WORKER_URL = 'https://sveltia-cms-auth.tap-647.workers.dev';

// Config file locations — both repos that received the fix
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const CONFIG_SOURCES = [
  {
    label: 'astro_sveltia/public/admin/config.yml',
    path: path.resolve(PROJECT_ROOT, '..', 'astro_sveltia', 'public', 'admin', 'config.yml'),
    always: true,
  },
  {
    label: 'astro_sveltia/public/admin/config/main.yml',
    path: path.resolve(PROJECT_ROOT, '..', 'astro_sveltia', 'public', 'admin', 'config', 'main.yml'),
    always: true,
  },
  {
    label: 'Documental/public/admin/config.yml',
    path: '/home/node/Workspaces/Documental/public/admin/config.yml',
    always: false,
  },
  {
    label: 'Documental/public/admin/config/main.yml',
    path: '/home/node/Workspaces/Documental/public/admin/config/main.yml',
    always: false,
  },
  {
    label: 'Documental-1/public/admin/config.yml',
    path: '/home/node/Workspaces/Documental-1/public/admin/config.yml',
    always: false,
  },
  {
    label: 'Documental-1/public/admin/config/main.yml',
    path: '/home/node/Workspaces/Documental-1/public/admin/config/main.yml',
    always: false,
  },
];

// Filter to configs that exist on this machine
const AVAILABLE_CONFIGS = CONFIG_SOURCES.filter(({ path: p }) => fs.existsSync(p));

describe('Sveltia CMS Loading Fix — Config Regression', () => {
  describe('No config file may contain the dead auth worker URL', () => {
    AVAILABLE_CONFIGS.forEach(({ label, path: configPath }) => {
      it(`${label} must not contain dead base_url`, () => {
        const content = fs.readFileSync(configPath, 'utf8');
        expect(content).not.toContain(DEAD_AUTH_WORKER_URL);
      });
    });
  });

  describe('All config files must have a valid github backend', () => {
    AVAILABLE_CONFIGS.forEach(({ label, path: configPath }) => {
      it(`${label} has backend.name: github and repo defined`, () => {
        const content = fs.readFileSync(configPath, 'utf8');
        expect(content).toContain('name: github');
        expect(content).toContain('repo:');
      });
    });
  });

  describe('Config source coverage', () => {
    it('should test at least the astro_sveltia configs (always available)', () => {
      const alwaysConfigs = AVAILABLE_CONFIGS.filter(c => c.always);
      expect(alwaysConfigs.length).toBeGreaterThanOrEqual(2);
    });
  });
});
