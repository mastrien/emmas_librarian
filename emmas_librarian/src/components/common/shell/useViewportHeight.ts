import { useEffect, useState } from 'react';

/**
 * The window's inner height, kept current on resize.
 *
 * @example const height = useViewportHeight(); quickAccessSlots(height);
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return height;
}
