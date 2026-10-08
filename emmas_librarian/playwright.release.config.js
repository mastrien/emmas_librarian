const { defineConfig } = require('@playwright/test');

// Release upgrade test (release-tests/upgrade.release.ts): installs real builds, so it runs only from
// .github/workflows/release-upgrade-test.yml, never as part of `npm test` or the E2E suite.
module.exports = defineConfig({
  testDir: './release-tests',
  testMatch: '**/*.release.ts',
  timeout: 15 * 60 * 1000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  outputDir: './test-results/release',
  use: {
    headless: false,
  },
});
