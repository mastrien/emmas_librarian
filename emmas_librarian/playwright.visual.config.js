const path = require('path');
const { defineConfig } = require('@playwright/test');
const { visualDir } = require('./visual-tests/visualPaths');

// Before/after screenshots for the redesign's phases 1-3 (Arca 134), which must not change how a screen looks.
// The images show the example project's data, so they live outside the repository (VISUAL_SNAPSHOT_DIR, by default
// a folder in the system temp dir) and are never committed. Usage in visual-tests/README.md.

module.exports = defineConfig({
  testDir: './visual-tests',
  testMatch: '**/*.visual.js',
  timeout: 10 * 60 * 1000, // one test walks every screen in every theme and width
  workers: 1,
  fullyParallel: false,
  retries: 0,
  snapshotPathTemplate: path.join(visualDir(), '{arg}{ext}'),
  expect: {
    toHaveScreenshot: {
      // Font antialiasing differs by a few pixels between runs; a moved or recoloured element changes thousands.
      maxDiffPixels: 150,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: { headless: false },
});
