import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    getPathForFile: vi.fn().mockImplementation((file: any) => file.path || file.name),
  },
  writable: true,
});
