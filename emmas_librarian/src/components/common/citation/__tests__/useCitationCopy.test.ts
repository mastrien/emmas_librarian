import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCitationCopy } from '../useCitationCopy';
import { FakeCitationClipboard } from '../../../../utils/__tests__/fakes/FakeCitationClipboard';

describe('useCitationCopy', () => {
  let clipboard: FakeCitationClipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    clipboard = new FakeCitationClipboard();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('copies the citations and shows "copied" for two seconds', async () => {
    const { result } = renderHook(() => useCitationCopy(clipboard));

    await act(() => result.current.copy(['Silva, 2020.'], 'text'));

    expect(clipboard.texts).toEqual(['Silva, 2020.']);
    expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.copied).toBe(false);
  });

  it('restarts the two seconds when copying again before they end', async () => {
    const { result } = renderHook(() => useCitationCopy(clipboard));

    await act(() => result.current.copy(['A'], 'text'));
    act(() => vi.advanceTimersByTime(1500));
    await act(() => result.current.copy(['B'], 'text'));
    act(() => vi.advanceTimersByTime(1500));

    expect(result.current.copied).toBe(true);
  });

  // The timer outlived the modal and fired after jsdom was torn down: "window is not defined" on the
  // Windows CI right after MassCitationModal.behavior.test (run 42151615653).
  it('leaves no timer behind when the component unmounts', async () => {
    const { result, unmount } = renderHook(() => useCitationCopy(clipboard));
    await act(() => result.current.copy(['A'], 'text'));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
