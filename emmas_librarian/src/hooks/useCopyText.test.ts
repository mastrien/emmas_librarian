import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCopyText, type TextClipboard } from './useCopyText';

class FakeClipboard implements TextClipboard {
  written: string[] = [];
  async writeText(text: string) {
    this.written.push(text);
  }
}

class RefusingClipboard implements TextClipboard {
  async writeText(): Promise<void> {
    throw new Error('denied');
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCopyText', () => {
  it('copies the text and says so for two seconds', async () => {
    vi.useFakeTimers();
    const clipboard = new FakeClipboard();
    const { result } = renderHook(() => useCopyText(clipboard));

    await act(async () => result.current.copy('erro 1'));

    expect(clipboard.written).toEqual(['erro 1']);
    expect(result.current.copied).toBe(true);
    await act(async () => vi.advanceTimersByTime(2000));
    expect(result.current.copied).toBe(false);
  });

  it('restarts the two seconds on a second copy', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyText(new FakeClipboard()));

    await act(async () => result.current.copy('a'));
    await act(async () => vi.advanceTimersByTime(1500));
    await act(async () => result.current.copy('b'));
    await act(async () => vi.advanceTimersByTime(1500));

    expect(result.current.copied).toBe(true);
  });

  it('does not claim a copy when the clipboard refuses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCopyText(new RefusingClipboard()));

    await act(async () => result.current.copy('x'));

    expect(result.current.copied).toBe(false);
  });

  it('does not claim a copy when there is no clipboard', async () => {
    const { result } = renderHook(() => useCopyText(undefined));

    await act(async () => result.current.copy('x'));

    expect(result.current.copied).toBe(false);
  });
});
