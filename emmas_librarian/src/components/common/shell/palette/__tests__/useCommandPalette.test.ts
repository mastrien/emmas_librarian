import { describe, it, expect } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { useCommandPalette } from '../useCommandPalette';

const press = (init: KeyboardEventInit) => act(() => void fireEvent.keyDown(window, init));

describe('useCommandPalette', () => {
  it('opens with Ctrl+K and with Cmd+K', () => {
    const { result } = renderHook(() => useCommandPalette());

    press({ key: 'k', ctrlKey: true });
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    press({ key: 'K', metaKey: true });
    expect(result.current.isOpen).toBe(true);
  });

  it('ignores a plain k and Ctrl+Alt+K', () => {
    const { result } = renderHook(() => useCommandPalette());

    press({ key: 'k' });
    press({ key: 'k', ctrlKey: true, altKey: true });

    expect(result.current.isOpen).toBe(false);
  });

  it('keeps the browser from handling Ctrl+K itself', () => {
    renderHook(() => useCommandPalette());
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });

    act(() => void window.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
  });
});
