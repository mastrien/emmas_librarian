import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Suites that opt into `@vitest-environment node` (e.g. real zip/SQLite round trips) have no window.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'electronAPI', {
    value: {
      invoke: vi.fn().mockResolvedValue(null),
      on: vi.fn(),
      getPathForFile: vi.fn().mockImplementation((file: { path: string; name?: string }) => file.path || file.name),
    },
    writable: true,
  });
}

if (typeof global.URL.createObjectURL === 'undefined') {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
}
