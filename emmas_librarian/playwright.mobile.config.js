const { defineConfig, devices } = require('@playwright/test');

// The phone client in a real browser (Chromium, phone-sized), against a real desktop sync stack
// (mobile/e2e/syncServer.ts). It needs no display and no Electron.
// Where the browser is not the one Playwright installs (a container with its own Chromium): PW_CHROMIUM_PATH=/path/to/chrome.
const launchOptions = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] }
  : {};

module.exports = defineConfig({
  testDir: './mobile/e2e',
  testMatch: '**/*.spec.js',
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4180', headless: true, launchOptions },
  webServer: {
    command: 'npm run build:mobile && npx vite-node mobile/e2e/syncServer.ts',
    url: 'http://localhost:4180/api/ping',
    timeout: 120000,
    reuseExistingServer: false,
  },
});
