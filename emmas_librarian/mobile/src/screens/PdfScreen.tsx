import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { Highlight } from '../../../src/types';
import { Await, Empty, ScreenHeader } from '../components';
import { overlayFill, type HighlightColor } from '../pdf/highlightColors';
import { rectsOnPage, scaledPosition } from '../pdf/highlightGeometry';
import { openPdf, type PdfOpener, type PdfPages } from '../pdf/pdfDocument';
import { readPageSelection, type PageSelection } from '../pdf/selection';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';
import { HighlightBar } from './HighlightBar';

interface PageProps {
  pdf: PdfPages;
  pageNumber: number;
  width: number;
  /** The page the screen opened on: it is brought into view. */
  focused: boolean;
  highlights: Highlight[];
}

/** Draws a page only when it comes near the screen: a long PDF drawn at once would not fit a phone's memory. */
function useDrawWhenNear(
  canvas: React.RefObject<HTMLCanvasElement | null>,
  draw: () => void,
  focused: boolean,
  deps: unknown[],
): void {
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    if (focused) element.scrollIntoView?.();
    if (typeof IntersectionObserver === 'undefined') return draw();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        draw();
      },
      { rootMargin: '600px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** The marks already made on a page, drawn over it. */
const PageMarks: React.FC<{ highlights: Highlight[]; pageNumber: number; width: number }> = ({
  highlights,
  pageNumber,
  width,
}) => (
  <>
    {highlights.flatMap((highlight) =>
      rectsOnPage(highlight.position_data, pageNumber, width).map((rect, index) => (
        <span
          key={`${highlight.id}-${index}`}
          className="m-pdf-mark"
          data-testid="pdf-mark"
          style={{ ...rect, background: overlayFill(highlight.color) }}
        />
      )),
    )}
  </>
);

const PdfPage: React.FC<PageProps> = ({ pdf, pageNumber, width, focused, highlights }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const draw = () => {
    if (canvas.current) void pdf.renderPage(pageNumber, canvas.current, width).catch(() => setFailed(true));
    if (textLayer.current) void pdf.renderTextLayer?.(pageNumber, textLayer.current, width).catch(() => undefined);
  };
  useDrawWhenNear(canvas, draw, focused, [pdf, pageNumber, width, focused]);
  const height = width * pdf.pageRatio;
  return (
    <figure
      className="m-pdf-page"
      aria-label={`Página ${pageNumber}`}
      data-page-number={pageNumber}
      style={{ width, height }}
    >
      <canvas ref={canvas} style={{ width, height }} />
      <PageMarks highlights={highlights} pageNumber={pageNumber} width={width} />
      {pdf.renderTextLayer && <div ref={textLayer} className="textLayer m-pdf-text" />}
      {failed && <figcaption role="alert">Não foi possível desenhar a página {pageNumber}.</figcaption>}
    </figure>
  );
};

const pagesOf = (pdf: PdfPages) => Array.from({ length: pdf.pageCount }, (_unused, index) => index + 1);
const screenWidth = () => Math.min(globalThis.innerWidth || 360, 900) - 16;

/** Follows what is selected on the page, so the bar to mark it can show up. */
function useSelection(read: () => PageSelection | null, enabled: boolean): [PageSelection | null, () => void] {
  const [selection, setSelection] = useState<PageSelection | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const update = () => setSelection(read());
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [read, enabled]);
  return [selection, () => setSelection(null)];
}

interface PdfBodyProps {
  pages: PdfPages;
  articleId: number;
  startPage: number;
  highlights: Highlight[];
  readSelection: () => PageSelection | null;
  onMarked: () => void;
}

const PdfBody: React.FC<PdfBodyProps> = ({ pages, articleId, startPage, highlights, readSelection, onMarked }) => {
  const reader = useReader();
  const canMark = Boolean(pages.renderTextLayer && reader.writer?.addHighlight);
  const [selection, clear] = useSelection(readSelection, canMark);
  const mark = async (color: HighlightColor, note: string) => {
    if (!selection) return;
    const positionData = scaledPosition(selection.rects, selection.page, selection.pageNumber);
    await reader.writer?.addHighlight?.(articleId, { color, positionData, contentText: selection.text, comment: note });
    window.getSelection()?.removeAllRanges();
    clear();
    onMarked();
  };
  return (
    <>
      {pagesOf(pages).map((pageNumber) => (
        <PdfPage
          key={pageNumber}
          pdf={pages}
          pageNumber={pageNumber}
          width={screenWidth()}
          focused={pageNumber === startPage}
          highlights={highlights}
        />
      ))}
      {selection && <HighlightBar text={selection.text} onMark={mark} onCancel={clear} />}
    </>
  );
};

/**
 * PDF of an article, one page under the other; `?page=N` opens on that page (the highlights list links there). Where
 * the library can be written, selecting text offers to mark it; marks already made are drawn over the page.
 *
 * @example <Route path="/articles/:articleId/pdf" element={<PdfScreen />} />
 */
export const PdfScreen: React.FC<{ open?: PdfOpener; readSelection?: () => PageSelection | null }> = ({
  open = openPdf,
  readSelection = () => readPageSelection(window.getSelection()),
}) => {
  const articleId = Number(useParams().articleId);
  const [search] = useSearchParams();
  const startPage = Number(search.get('page')) || 1;
  const reader = useReader();
  const load = useCallback(async () => {
    const bytes = await reader.readPdf(articleId);
    return bytes ? open(bytes) : null;
  }, [reader, articleId, open]);
  const pdf = useLoaded(load);
  const marks = useLoaded(useCallback(() => reader.listHighlights(articleId), [reader, articleId]));
  const opened = pdf.state === 'ready' ? pdf.value : null;
  useEffect(() => () => opened?.close(), [opened]);

  return (
    <main className="m-screen m-screen--pdf">
      <ScreenHeader title="PDF" back={`/articles/${articleId}`} />
      <Await loaded={pdf}>
        {(pages) =>
          !pages ? (
            <Empty>Este artigo não tem PDF disponível aqui.</Empty>
          ) : (
            <PdfBody
              pages={pages}
              articleId={articleId}
              startPage={startPage}
              highlights={marks.state === 'ready' ? marks.value : []}
              readSelection={readSelection}
              onMarked={marks.state === 'ready' ? marks.reload : () => undefined}
            />
          )
        }
      </Await>
    </main>
  );
};
