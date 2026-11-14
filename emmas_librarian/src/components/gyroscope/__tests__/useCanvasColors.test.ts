import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { readCanvasColors, readToken, useCanvasColors, type CanvasColors } from '../useCanvasColors';

describe('readToken', () => {
  it('is undefined when the page has no such colour (no styles, as in tests)', () => {
    expect(readToken(document.documentElement, '--nao-existe')).toBeUndefined();
  });

  it('leaves no element behind', () => {
    const before = document.documentElement.children.length;

    readToken(document.documentElement, '--bg-surface');

    expect(document.documentElement.children.length).toBe(before);
  });
});

describe('readCanvasColors', () => {
  it('takes the mode from the page, and the colours from its tokens when they resolve', () => {
    const root = document.createElement('html');
    root.setAttribute('data-theme', 'dark');

    expect(readCanvasColors(root)).toEqual({ ring: undefined, inner: undefined, theme: 'dark' });
  });
});

describe('useCanvasColors', () => {
  const fakeRead = (root: HTMLElement, token: string): CanvasColors => ({
    ring:
      token === '--accent'
        ? 'rgb(9, 9, 9)'
        : root.getAttribute('data-tone') === 'warm'
          ? 'rgb(1, 1, 1)'
          : 'rgb(2, 2, 2)',
    inner: 'rgb(3, 3, 3)',
    theme: 'light',
  });

  it('reads the colours again when an attribute of the page changes', async () => {
    const root = document.createElement('html');
    const { result } = renderHook(() => useCanvasColors('--quiet', root, fakeRead));
    expect(result.current.ring).toBe('rgb(2, 2, 2)');

    await act(async () => {
      root.setAttribute('data-tone', 'warm');
      await Promise.resolve();
    });

    expect(result.current.ring).toBe('rgb(1, 1, 1)');
  });

  it('takes the ring from the token it is asked for, and changes with it', () => {
    const root = document.createElement('html');
    const { result, rerender } = renderHook(({ token }) => useCanvasColors(token, root, fakeRead), {
      initialProps: { token: '--quiet' },
    });
    expect(result.current.ring).toBe('rgb(2, 2, 2)');

    rerender({ token: '--accent' });

    expect(result.current.ring).toBe('rgb(9, 9, 9)');
  });
});
