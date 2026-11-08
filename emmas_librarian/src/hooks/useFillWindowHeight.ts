import { useLayoutEffect, useState, type CSSProperties } from 'react';

/**
 * For a page that scrolls inside its panes: the height the app's header leaves of the window. It measures when the
 * element appears, not when the component mounts: that is still "Carregando…", and with nothing measured the page grew
 * with its table and the whole window scrolled until the next resize (seen on the first opening, #73).
 *
 * @example const { setPage, height } = useFillWindowHeight(); <div ref={setPage} style={{ height }} />
 */
export function useFillWindowHeight() {
  const [page, setPage] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!page) return;
    const measure = () => setHeight(window.innerHeight - page.getBoundingClientRect().top + window.scrollY);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [page]);
  return { setPage, height };
}

/**
 * The measured height as the page's style: a CSS variable the page's class reads (Arca 134: no inline layout), unset
 * until the first measure.
 *
 * @example <div ref={setPage} className="inv-page" style={fillHeightStyle(height)} />
 */
export function fillHeightStyle(height: number | undefined): CSSProperties | undefined {
  return height === undefined ? undefined : ({ '--fill-height': `${height}px` } as CSSProperties);
}
