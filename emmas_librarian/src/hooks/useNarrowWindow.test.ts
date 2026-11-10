import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NARROW_WINDOW_PX, useNarrowWindow } from './useNarrowWindow';

const setWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
};

describe('useNarrowWindow', () => {
  afterEach(() => setWidth(1024));

  it('is narrow up to the panels breakpoint by default', () => {
    setWidth(NARROW_WINDOW_PX);

    expect(renderHook(() => useNarrowWindow()).result.current).toBe(true);
  });

  it('takes another breakpoint and follows resizes', () => {
    setWidth(1150);
    const { result } = renderHook(() => useNarrowWindow(1199));
    expect(result.current).toBe(true);

    act(() => setWidth(1300));

    expect(result.current).toBe(false);
  });
});
