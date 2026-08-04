import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PdfTextChunk {
  text: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface PdfExtractionResult {
  chunks: PdfTextChunk[];
  totalPages: number;
  totalCharacters: number;
}

/** Extrai texto preservando layout e coordenadas usando pdfjs-dist. */
export async function extractTextWithCoordinates(
  pdfPath: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200,
): Promise<{ chunks: PdfTextChunk[]; totalPages: number; totalCharacters: number }> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const dataBuffer = fs.readFileSync(pdfPath);

  // Parse using pdf.js for text and coordinates
  const uint8Array = new Uint8Array(dataBuffer);
  const pdfDocument = await pdfjsLib.getDocument({
    data: uint8Array,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/',
  }).promise;
  const totalPages = pdfDocument.numPages;

  const chunks: PdfTextChunk[] = [];
  let totalCharacters = 0;

  let currentText = '';
  let currentBboxes: { x: number; y: number; w: number; h: number; page: number }[] = [];

  const pushCurrentChunk = () => {
    if (currentText.trim().length > 0 && currentBboxes.length > 0) {
      const anchorBbox = currentBboxes[0];

      chunks.push({
        text: currentText.trim(),
        page: anchorBbox.page,
        bbox: {
          x: anchorBbox.x,
          y: anchorBbox.y,
          w: anchorBbox.w,
          h: anchorBbox.h,
        },
      });
    }
  };

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      for (let itemIdx = 0; itemIdx < textContent.items.length; itemIdx++) {
        const item = textContent.items[itemIdx];
        if ('str' in item && 'transform' in item) {
          const text = item.str;
          const transform = item.transform;
          const width = item.width || 0;
          const height = item.height || 0;

          if (!text.trim() && text.length < 2) continue;

          const itemBbox = {
            x: transform[4],
            y: transform[5],
            w: width,
            h: height,
            page: pageNum,
          };

          currentText += text + ' ';
          currentBboxes.push(itemBbox);
          totalCharacters += text.length;

          if (currentText.length >= chunkSize) {
            pushCurrentChunk();

            let keepText = '';
            let keepBboxes: typeof currentBboxes = [];

            for (let i = currentBboxes.length - 1; i >= 0; i--) {
              keepBboxes.unshift(currentBboxes[i]);
              const startIndex = Math.max(0, itemIdx - (currentBboxes.length - 1 - i));
              const sliceItems = textContent.items.slice(startIndex, itemIdx + 1);
              keepText = sliceItems.map((x) => ('str' in x ? x.str : '')).join(' ');

              if (keepText.length >= chunkOverlap) {
                break;
              }
            }

            currentText = keepText + ' ';
            currentBboxes = keepBboxes;
          }
        }
      }
    }

    if (currentText.length > 0) {
      pushCurrentChunk();
    }
  } finally {
    if (pdfDocument && typeof (pdfDocument as any).destroy === 'function') {
      try {
        await pdfDocument.destroy();
      } catch (destroyErr) {
        console.warn('Failed to destroy pdfDocument instance:', destroyErr);
      }
    }
  }

  return {
    chunks,
    totalPages,
    totalCharacters,
  };
}

/** Renderiza páginas específicas como imagens Base64 para VLM. (Placeholder) */
export async function renderPagesAsImages(pdfPath: string, pages: number[]): Promise<Map<number, string>> {
  // Not implemented yet
  return new Map<number, string>();
}
