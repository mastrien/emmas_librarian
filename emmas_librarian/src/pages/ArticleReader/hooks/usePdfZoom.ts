import { useState, useEffect, RefObject } from 'react';

export function usePdfZoom(highlighterRef: RefObject<{ viewer?: { currentScaleValue: string } }>) {
  const [scale, setScale] = useState(1.0);

  const handleZoom = (updater: number | ((s: number) => number)) => {
    setScale((s) => {
      const newScale = typeof updater === 'function' ? updater(s) : updater;
      return newScale;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setScale((s) => Math.min(s + 0.2, 3));
        } else if (e.key === '-') {
          e.preventDefault();
          setScale((s) => Math.max(s - 0.2, 0.5));
        } else if (e.key === '0') {
          e.preventDefault();
          setScale(1.0);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setScale((s) => Math.min(s + 0.1, 3));
        } else if (e.deltaY > 0) {
          setScale((s) => Math.max(s - 0.1, 0.5));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    if (highlighterRef.current && highlighterRef.current.viewer) {
      highlighterRef.current.viewer.currentScaleValue = scale.toString();
    }
  }, [scale, highlighterRef]);

  return { scale, handleZoom };
}
