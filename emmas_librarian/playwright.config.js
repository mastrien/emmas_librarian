const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e-tests',
  // Vitest unit tests of the E2E helpers, not Playwright specs.
  testIgnore: '**/__tests__/**',
  timeout: 60000, // 60 seconds timeout per test for safety
  workers: 1, // run sequentially to avoid Electron instance / database lock collisions
  fullyParallel: false,
  retries: 2,
  use: {
    headless: false, // Electron tests must run with GUI
  },
});
