import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';
import { afterEach, vi } from 'vitest';

// findBy/waitFor give up after 1 s by default; a reload through the fake service under the CI coverage run can
// take longer (flakes in auditNavigation, #48, and the review page, #49), so every suite waits up to 4 s.
configure({ asyncUtilTimeout: 4000 });

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

// Pages keep view state in sessionStorage (useSessionState); clear it so no test sees another's filters.
afterEach(() => {
  if (typeof window !== 'undefined') window.sessionStorage.clear();
});
