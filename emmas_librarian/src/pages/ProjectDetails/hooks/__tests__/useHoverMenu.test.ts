import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHoverMenu } from '../useHoverMenu';

function withContainer() {
  const hook = renderHook(() => useHoverMenu());
  const container = document.body.appendChild(document.createElement('div'));
  const inside = container.appendChild(document.createElement('button'));
  (hook.result.current.ref as React.MutableRefObject<HTMLDivElement>).current = container;
  return { ...hook, container, inside };
}

const mousedown = (target: Element) => act(() => target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useHoverMenu', () => {
  it('starts closed and opens on hover', () => {
    const { result } = renderHook(() => useHoverMenu());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.onMouseEnter());

    expect(result.current.isOpen).toBe(true);
  });

  it('closes only after the delay once the pointer leaves', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHoverMenu(200));
    act(() => result.current.onMouseEnter());

    act(() => result.current.onMouseLeave());
    act(() => vi.advanceTimersByTime(199));
    expect(result.current.isOpen).toBe(true);
    act(() => vi.advanceTimersByTime(1));

    expect(result.current.isOpen).toBe(false);
  });

  it('stays open when the pointer comes back before the delay', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHoverMenu());
    act(() => result.current.onMouseEnter());

    act(() => result.current.onMouseLeave());
    act(() => result.current.onMouseEnter());
    act(() => vi.advanceTimersByTime(500));

    expect(result.current.isOpen).toBe(true);
  });

  it('closes on a click outside but not inside the menu', () => {
    const { result, inside } = withContainer();
    act(() => result.current.setIsOpen(true));

    mousedown(inside);
    expect(result.current.isOpen).toBe(true);

    mousedown(document.body);
    expect(result.current.isOpen).toBe(false);
  });

  it('stops listening and cancels a pending close when unmounted', () => {
    vi.useFakeTimers();
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = renderHook(() => useHoverMenu());
    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());

    unmount();

    expect(removeListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
});
