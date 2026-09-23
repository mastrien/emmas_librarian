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
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/release/**',
      '**/.stryker-tmp/**',
      '**/e2e-tests/**',
      '**/performance-tests/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['electron/**/*', 'src/**/*'],
      exclude: [
        'electron/**/__tests__/**',
        'src/**/__tests__/**',
        'electron/preload.ts',
        'electron/main.ts',
        'electron/types.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      // Ratchet: floor of measured coverage, raised as coverage improves. Never lower it.
      thresholds: {
        lines: 88,
        branches: 86,
        functions: 75,
        statements: 88,
        'electron/**/*': {
          lines: 94,
          branches: 90,
          functions: 94,
          statements: 94,
        },
      },
    },
  },
});
