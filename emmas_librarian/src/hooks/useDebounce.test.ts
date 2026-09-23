import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebounce', () => {
  it('returns the latest value only after it stops changing for the delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), { initialProps: { value: 'a' } });

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(60));
    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(60));

    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(40));
    expect(result.current).toBe('c');
  });
});
