import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePdfZoom } from './usePdfZoom';
import { RefObject } from 'react';

describe('usePdfZoom', () => {
  let highlighterRef: RefObject<{ viewer?: { currentScaleValue: string } }>;

  beforeEach(() => {
    highlighterRef = { current: { viewer: { currentScaleValue: '1' } } };
  });

  it('initializes with scale 1.0', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));
    expect(result.current.scale).toBe(1.0);
  });

  it('handles handleZoom with a number', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      result.current.handleZoom(1.5);
    });

    expect(result.current.scale).toBe(1.5);
    expect(highlighterRef.current!.viewer!.currentScaleValue).toBe('1.5');
  });

  it('handles handleZoom with an updater function', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      result.current.handleZoom((s) => s + 0.5);
    });

    expect(result.current.scale).toBe(1.5);
  });

  it('zooms in on Ctrl + =', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: '=' });
      window.dispatchEvent(event);
    });

    expect(result.current.scale).toBeCloseTo(1.2);
  });

  it('zooms out on Ctrl + -', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: '-' });
      window.dispatchEvent(event);
    });

    expect(result.current.scale).toBeCloseTo(0.8);
  });

  it('resets zoom on Ctrl + 0', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      result.current.handleZoom(2.0);
    });

    act(() => {
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: '0' });
      window.dispatchEvent(event);
    });

    expect(result.current.scale).toBe(1.0);
  });

  it('zooms in on Ctrl + Wheel up (deltaY < 0)', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      const event = new WheelEvent('wheel', { ctrlKey: true, deltaY: -100 });
      window.dispatchEvent(event);
    });

    expect(result.current.scale).toBeCloseTo(1.1);
  });

  it('zooms out on Ctrl + Wheel down (deltaY > 0)', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      const event = new WheelEvent('wheel', { ctrlKey: true, deltaY: 100 });
      window.dispatchEvent(event);
    });

    expect(result.current.scale).toBeCloseTo(0.9);
  });

  it('does not zoom if ctrl is not pressed on keydown', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      const event = new KeyboardEvent('keydown', { ctrlKey: false, key: '=' });
      window.dispatchEvent(event);
    });

    expect(result.current.scale).toBe(1.0);
  });

  it('does not zoom if ctrl is not pressed on wheel', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      const event = new WheelEvent('wheel', { ctrlKey: false, deltaY: -100 });
      window.dispatchEvent(event);
    });

    expect(result.current.scale).toBe(1.0);
  });

  it('enforces min and max scales', () => {
    const { result } = renderHook(() => usePdfZoom(highlighterRef));

    act(() => {
      result.current.handleZoom(3.5);
    });
    // Wait, handleZoom doesn't enforce bounds itself, but keyboard events do.
    // Let's test the keyboard event limits.
    act(() => {
      result.current.handleZoom(2.9);
    });
    act(() => {
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: '=' });
      window.dispatchEvent(event);
    });
    expect(result.current.scale).toBe(3); // capped at 3

    act(() => {
      result.current.handleZoom(0.6);
    });
    act(() => {
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: '-' });
      window.dispatchEvent(event);
    });
    expect(result.current.scale).toBe(0.5); // capped at 0.5
  });
});
