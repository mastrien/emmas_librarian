import { afterEach, describe, expect, it, vi } from 'vitest';
import { droppedFilePath } from '../droppedFilePath';

describe('droppedFilePath', () => {
  const bridge = window.electronAPI;

  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', { value: bridge, writable: true });
  });

  it('asks the preload bridge for the path of the file', () => {
    vi.mocked(window.electronAPI.getPathForFile).mockReturnValueOnce('C:\\Downloads\\tese.emmapcarc');

    expect(droppedFilePath(new File([''], 'tese.emmapcarc'))).toBe('C:\\Downloads\\tese.emmapcarc');
  });

  it('falls back to File.path, then to the bare name, without the bridge', () => {
    Object.defineProperty(window, 'electronAPI', { value: undefined, writable: true });
    const withPath = new File([''], 'a.pdf');
    Object.defineProperty(withPath, 'path', { value: '/docs/a.pdf' });

    expect(droppedFilePath(withPath)).toBe('/docs/a.pdf');
    expect(droppedFilePath(new File([''], 'b.pdf'))).toBe('b.pdf');
  });
});
