import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useViewportHeight } from '../useViewportHeight';

const initialHeight = window.innerHeight;

afterEach(() => {
  window.innerHeight = initialHeight;
});

describe('useViewportHeight', () => {
  it('follows the window height on resize', () => {
    const { result } = renderHook(() => useViewportHeight());

    act(() => {
      window.innerHeight = 640;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(640);
  });
});
