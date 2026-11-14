import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** An open PDF as the viewer needs it; the screens never touch pdf.js directly. */
export interface PdfPages {
  pageCount: number;
  /** Height divided by width of the first page, to reserve room for pages not drawn yet. */
  pageRatio: number;
  /** Draws page `pageNumber` (from 1) on the canvas, `cssWidth` CSS pixels wide. */
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<void>;
  close(): void;
}

export type PdfOpener = (bytes: Uint8Array) => Promise<PdfPages>;

// Phones have dense screens but little memory: sharp enough to read, never more than 2x.
const pixelRatio = () => Math.min(globalThis.devicePixelRatio || 1, 2);

/**
 * Opens a PDF with pdf.js, read-only (the wrapper this project owns around the library).
 *
 * Usage:
 *   const pdf = await openPdf(bytes);
 *   await pdf.renderPage(1, canvas, 360);
 */
export const openPdf: PdfOpener = async (bytes) => {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // pdf.js takes ownership of the buffer it is given; the reader may hand the same bytes out again.
  const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const first = (await document.getPage(1)).getViewport({ scale: 1 });
  return {
    pageCount: document.numPages,
    pageRatio: first.height / first.width,
    async renderPage(pageNumber, canvas, cssWidth) {
      const page = await document.getPage(pageNumber);
      const scale = (cssWidth / page.getViewport({ scale: 1 }).width) * pixelRatio();
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    },
    close: () => void document.destroy(),
  };
};
