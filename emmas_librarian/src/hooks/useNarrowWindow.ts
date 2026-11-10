import { useEffect, useState } from 'react';

// Below this the investigation's side panels stop sharing the row and become drawers (decided on the #73 prototype).
export const NARROW_WINDOW_PX = 1100;

/**
 * Whether the window is at most `maxWidth` wide: by default, too narrow for side panels beside the content.
 *
 * @example const narrow = useNarrowWindow(); const folded = useNarrowWindow(1199);
 */
export function useNarrowWindow(maxWidth: number = NARROW_WINDOW_PX): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth <= maxWidth);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= maxWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [maxWidth]);
  return narrow;
}
