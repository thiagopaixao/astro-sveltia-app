/// <reference types="vitest" />
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs}'],
    exclude: ['node_modules', 'dist', '.electron'],
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.js',
        '**/*.spec.js',
        'main.js',
        'preload.js'
      ]
    }
  },
  resolve: {
    alias: {
      '@': require('path').resolve(__dirname, './src'),
      '@main': require('path').resolve(__dirname, './src/main'),
      '@domain': require('path').resolve(__dirname, './src/domain'),
      '@application': require('path').resolve(__dirname, './src/application'),
      '@infrastructure': require('path').resolve(__dirname, './src/infrastructure')
    }
  }
});