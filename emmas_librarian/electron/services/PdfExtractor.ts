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
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/'
  }).promise;
  const totalPages = pdfDocument.numPages;

  const chunks: PdfTextChunk[] = [];
  let totalCharacters = 0;

  let currentText = '';
  let currentBboxes: { x: number; y: number; w: number; h: number; page: number }[] = [];
  
  const pushCurrentChunk = () => {
    if (currentText.trim().length > 0 && currentBboxes.length > 0) {
      // Create a bounding box that encapsulates the first few items or a general area
      // For simplicity in UI highlighting, we can take the bbox of the first item
      // or a union. Let's use the first item's bbox as the anchor point
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

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if ('str' in item && 'transform' in item) {
        const text = item.str;
        const transform = item.transform;
        const width = item.width || 0;
        const height = item.height || 0;

        // Skip completely empty items that just provide spacing
        if (!text.trim() && text.length < 2) continue;

        const itemBbox = {
          x: transform[4],
          y: transform[5],
          w: width,
          h: height,
          page: pageNum
        };

        currentText += text + ' ';
        currentBboxes.push(itemBbox);
        totalCharacters += text.length;

        if (currentText.length >= chunkSize) {
          pushCurrentChunk();
          
          // Slide window: keep the last 'chunkOverlap' characters
          // We need to find which bboxes correspond to the overlap
          let keepText = '';
          let keepBboxes: typeof currentBboxes = [];
          
          // Work backwards to fill the overlap
          for (let i = currentBboxes.length - 1; i >= 0; i--) {
            // Estimate text length contribution (this is approximate since we added spaces)
            // A more precise way is to keep track of strings, but this is efficient enough
            keepBboxes.unshift(currentBboxes[i]);
            // Re-build text from kept bboxes roughly
            keepText = textContent.items
              .slice(Math.max(0, textContent.items.indexOf(item) - (currentBboxes.length - 1 - i)), textContent.items.indexOf(item) + 1)
              .map(x => 'str' in x ? x.str : '').join(' ');
              
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
  
  // push remaining
  if (currentText.length > 0) {
    pushCurrentChunk();
  }

  return {
    chunks,
    totalPages,
    totalCharacters,
  };
}

/** Renderiza páginas específicas como imagens Base64 para VLM. (Placeholder) */
export async function renderPagesAsImages(
  pdfPath: string,
  pages: number[]
): Promise<Map<number, string>> {
  // Not implemented yet
  return new Map<number, string>();
}
