const { defineConfig } = require('vitest/config');
const path = require('path');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.cjs'],
    setupFiles: [path.resolve(__dirname, 'tests/setup/index.cjs')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov']
    }
  }
});
