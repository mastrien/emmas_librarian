import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Await, Empty, ScreenHeader } from '../components';
import { openPdf, type PdfOpener, type PdfPages } from '../pdf/pdfDocument';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';

interface PageProps {
  pdf: PdfPages;
  pageNumber: number;
  width: number;
  /** The page the screen opened on: it is brought into view. */
  focused: boolean;
}

// A page is drawn when it comes near the screen: a long PDF drawn at once would not fit a phone's memory.
const PdfPage: React.FC<PageProps> = ({ pdf, pageNumber, width, focused }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    if (focused) element.scrollIntoView?.();
    const draw = () => void pdf.renderPage(pageNumber, element, width).catch(() => setFailed(true));
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
  }, [pdf, pageNumber, width, focused]);

  return (
    <figure className="m-pdf-page" aria-label={`Página ${pageNumber}`}>
      <canvas ref={canvas} style={{ width, height: width * pdf.pageRatio }} />
      {failed && <figcaption role="alert">Não foi possível desenhar a página {pageNumber}.</figcaption>}
    </figure>
  );
};

const pagesOf = (pdf: PdfPages) => Array.from({ length: pdf.pageCount }, (_unused, index) => index + 1);
const screenWidth = () => Math.min(globalThis.innerWidth || 360, 900) - 16;

/**
 * Read-only PDF of an article, one page under the other; `?page=N` opens on that page (the highlights
 * list links there).
 *
 * @example <Route path="/articles/:articleId/pdf" element={<PdfScreen />} />
 */
export const PdfScreen: React.FC<{ open?: PdfOpener }> = ({ open = openPdf }) => {
  const articleId = Number(useParams().articleId);
  const [search] = useSearchParams();
  const startPage = Number(search.get('page')) || 1;
  const reader = useReader();
  const load = useCallback(async () => {
    const bytes = await reader.readPdf(articleId);
    return bytes ? open(bytes) : null;
  }, [reader, articleId, open]);
  const pdf = useLoaded(load);
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
            pagesOf(pages).map((pageNumber) => (
              <PdfPage
                key={pageNumber}
                pdf={pages}
                pageNumber={pageNumber}
                width={screenWidth()}
                focused={pageNumber === startPage}
              />
            ))
          )
        }
      </Await>
    </main>
  );
};
