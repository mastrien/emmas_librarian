import type { ScreenRect } from './highlightGeometry';

/** What the person selected on one page. */
export interface PageSelection {
  pageNumber: number;
  text: string;
  rects: ScreenRect[];
  /** The page's own box on screen, to turn the rectangles into positions on it. */
  page: ScreenRect;
}

const boxOf = (rect: DOMRect): ScreenRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

/**
 * Reads the text the person selected, if it lies inside one page of the PDF (an element with
 * `data-page-number`); null when nothing is selected or the selection crosses pages.
 *
 * @example const selection = readPageSelection(window.getSelection(), document)
 */
export function readPageSelection(selection: Selection | null): PageSelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const start = pageOf(range.startContainer);
  const end = pageOf(range.endContainer);
  const text = selection.toString().trim();
  if (!start || start !== end || text === '') return null;
  const pageNumber = Number(start.dataset.pageNumber);
  return {
    pageNumber,
    text,
    rects: Array.from(range.getClientRects(), boxOf),
    page: boxOf(start.getBoundingClientRect()),
  };
}

function pageOf(node: Node): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest<HTMLElement>('[data-page-number]') ?? null;
}
