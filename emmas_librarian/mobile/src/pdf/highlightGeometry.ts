/** A rectangle in screen pixels (what `Range.getClientRects` gives). */
export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A rectangle as the desktop's reader stores it: corners in pixels of a page `width` × `height` wide, so it can be
 * drawn again at any zoom by scaling with the page's width.
 */
export interface ScaledRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number;
}

export interface ScaledPosition {
  boundingRect: ScaledRect;
  rects: ScaledRect[];
}

function scaled(rect: ScreenRect, page: ScreenRect, pageNumber: number): ScaledRect {
  const x1 = rect.left - page.left;
  const y1 = rect.top - page.top;
  return { x1, y1, x2: x1 + rect.width, y2: y1 + rect.height, width: page.width, height: page.height, pageNumber };
}

function union(rects: ScaledRect[]): ScaledRect {
  const first = rects[0];
  return {
    ...first,
    x1: Math.min(...rects.map((rect) => rect.x1)),
    y1: Math.min(...rects.map((rect) => rect.y1)),
    x2: Math.max(...rects.map((rect) => rect.x2)),
    y2: Math.max(...rects.map((rect) => rect.y2)),
  };
}

/**
 * The position of a selection on a page, in the form the desktop stores for a highlight.
 *
 * @example scaledPosition([{ left: 120, top: 220, width: 80, height: 14 }], pageBox, 6)
 * @throws Error when there is no rectangle, since a highlight without one cannot be drawn
 */
export function scaledPosition(selected: ScreenRect[], page: ScreenRect, pageNumber: number): ScaledPosition {
  const visible = selected.filter((rect) => rect.width > 0 && rect.height > 0);
  if (visible.length === 0)
    throw new Error(
      `A highlight needs at least one rectangle on page ${pageNumber}, got ${selected.length} empty ones`,
    );
  const rects = visible.map((rect) => scaled(rect, page, pageNumber));
  return { boundingRect: union(rects), rects };
}

/** The rectangles of a stored position on `pageNumber`, in CSS pixels for a page drawn `cssWidth` wide. */
export function rectsOnPage(position: unknown, pageNumber: number, cssWidth: number): ScreenRect[] {
  const rects = (position as { rects?: ScaledRect[] } | null)?.rects;
  if (!Array.isArray(rects)) return [];
  return rects
    .filter((rect) => rect.pageNumber === pageNumber && rect.width > 0)
    .map((rect) => {
      const factor = cssWidth / rect.width;
      return {
        left: rect.x1 * factor,
        top: rect.y1 * factor,
        width: (rect.x2 - rect.x1) * factor,
        height: (rect.y2 - rect.y1) * factor,
      };
    });
}
