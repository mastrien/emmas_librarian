import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useThemeMode } from '../useThemeMode';

describe('useThemeMode', () => {
  it('reads the mode of the page and follows it when it changes', async () => {
    const root = document.createElement('html');
    root.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useThemeMode(root));
    expect(result.current).toBe('dark');

    await act(async () => {
      root.setAttribute('data-theme', 'light');
      await Promise.resolve();
    });

    expect(result.current).toBe('light');
  });

  it('is light when the page names no mode', () => {
    const { result } = renderHook(() => useThemeMode(document.createElement('html')));

    expect(result.current).toBe('light');
  });
});
