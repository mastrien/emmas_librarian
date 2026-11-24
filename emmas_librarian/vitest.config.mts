import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      electron: path.resolve(__dirname, 'node_modules/electron'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    // The CI runners, Windows above all, are slow at disk work while hundreds of files run with coverage: a
    // backup restore (#48), a full library copy and a file rename (#66, #69) passed 5 s there and nowhere else.
    // Locally the default stays, so a test that really became slow still shows.
    testTimeout: process.env.CI ? 20_000 : 5_000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/dist-mobile/**',
      '**/release/**',
      '**/.stryker-tmp/**',
      // Playwright specs; e2e-tests/__tests__ holds unit tests of the E2E helpers and runs here.
      '**/e2e-tests/*.{spec,test}.js',
      '**/performance-tests/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['adapters/**/*', 'core/**/*', 'src/**/*', 'mobile/src/**/*'],
      exclude: [
        'adapters/**/__tests__/**',
        'core/**/__tests__/**',
        'src/**/__tests__/**',
        'mobile/src/**/__tests__/**',
        // Entry point and the thin wrapper around pdf.js, which needs a real browser canvas (covered by E2E).
        'mobile/src/main.tsx',
        'mobile/src/pdf/pdfDocument.ts',
        'adapters/electron/preload.ts',
        'adapters/electron/main.ts',
        'adapters/electron/types.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        // The two evaluation scripts start llama-server with real models on a GPU and run for hours, so they cannot run
        // in a unit test. What they use (modes, setup, scoring, the episode loop) is tested one by one (#195, #201).
        'core/harness/eval/run/runEval.ts',
        'core/harness/eval/decision/runDecisionEval.ts',
      ],
      // Ratchet: floor of measured coverage, raised as coverage improves. Never lower it.
      thresholds: {
        lines: 93,
        branches: 91,
        functions: 89,
        statements: 93,
        'adapters/**/*': {
          lines: 95,
          branches: 91,
          functions: 99,
          statements: 95,
        },
        // The library without a shell (epic #27); it held most of what adapters/electron/ covered before the split.
        'core/**/*': {
          lines: 96,
          branches: 94,
          functions: 99,
          statements: 96,
        },
      },
    },
  },
});
