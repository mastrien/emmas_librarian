import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/release/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    coverage: {
      provider: 'v8',
      include: ['electron/**/*'],
      exclude: [
        'electron/**/__tests__/**',
        'electron/preload.ts',
        'electron/main.ts',
        'electron/types.ts'
      ]
    }
  }
});
