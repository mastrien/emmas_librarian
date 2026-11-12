import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSpeakingAfterAnswer } from '../useSpeakingAfterAnswer';

afterEach(() => vi.useRealTimers());

const setup = (initial: string | null) =>
  renderHook(({ pending }) => useSpeakingAfterAnswer(pending), { initialProps: { pending: initial } });

describe('useSpeakingAfterAnswer', () => {
  it('does not speak when a conversation that was already answered is opened', () => {
    const { result } = setup(null);

    expect(result.current).toBe(false);
  });

  it('speaks for five seconds once the question on its way is answered, then stops', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup(null);
    rerender({ pending: 'Qual a amostra?' });
    expect(result.current).toBe(false);

    rerender({ pending: null });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(4900));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toBe(false);
  });

  it('stops at once when another question is sent', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup('a');
    rerender({ pending: null });
    expect(result.current).toBe(true);

    rerender({ pending: 'b' });

    expect(result.current).toBe(false);
  });
});
