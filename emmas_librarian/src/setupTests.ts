import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    getPathForFile: vi.fn().mockImplementation((file: { path: string; name?: string }) => file.path || file.name),
  },
  writable: true,
});

if (typeof global.URL.createObjectURL === 'undefined') {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
}
