import { useEffect, useState } from 'react';

// Below this the investigation's side panels stop sharing the row and become drawers (decided on the #73 prototype).
export const NARROW_WINDOW_PX = 1100;

/**
 * Whether the window is too narrow for side panels beside the content.
 *
 * @example const narrow = useNarrowWindow();
 */
export function useNarrowWindow(): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth <= NARROW_WINDOW_PX);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= NARROW_WINDOW_PX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}
