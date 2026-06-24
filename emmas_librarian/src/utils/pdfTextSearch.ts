import * as pdfjsLib from 'pdfjs-dist';

import { PendingHighlight } from '../types';

/**
 * Normalizes a string to make PDF text matching more robust.
 * PDFs often encode ligatures (ﬁ, ﬂ), em/en dashes, curly quotes,
 * soft hyphens, and non-breaking spaces differently from what an AI
 * would reproduce in a verbatim quote.
 */
function normalizePdfText(str: string): string {
  return (
    str
      // Ligatures
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      .replace(/ﬀ/g, 'ff')
      .replace(/ﬃ/g, 'ffi')
      .replace(/ﬄ/g, 'ffl')
      .replace(/ﬅ/g, 'ft')
      .replace(/ﬆ/g, 'st')
      // Em dash, en dash, minus sign → hyphen
      .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
      // Curly/smart quotes → straight
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Non-breaking space, zero-width chars, BOM → regular space / empty
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')
      // Soft hyphen (invisible in rendered text but present in PDF byte stream)
      .replace(/\u00AD/g, '')
      // NFKC normalization handles accented chars encoded with combining diacritics
      .normalize('NFKC')
  );
}

export async function anchorPendingHighlights(
  pdfUrl: string,
  pendingHighlights: PendingHighlight[],
  setStatus: (msg: string) => void,
) {
  if (!pendingHighlights || pendingHighlights.length === 0) return { anchoredHighlights: [], unanchoredHighlights: [] };

  setStatus('Abrindo documento para ancorar destaques...');
  const pdfDoc = await pdfjsLib.getDocument({
    url: pdfUrl,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/',
  }).promise;
  const numPages = pdfDoc.numPages;

  const anchoredHighlights = [];
  const unanchoredHighlights = [];

  for (const pending of pendingHighlights) {
    if (!pending.quote) continue;

    let foundRects = null;
    let foundPage = 0;

    setStatus(`Buscando citação: "${pending.quote.substring(0, 30)}..."`);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      const viewport = page.getViewport({ scale: 1 });
      const pageHeight = viewport.height;
      const pageWidth = viewport.width;

      // Extract text and item mappings
      let fullText = '';
      const itemMappings: {
        startIndex: number;
        endIndex: number;
        item: { str: string; transform: number[]; width: number; height: number };
      }[] = [];

      let strippedText = '';
      const strippedToOriginal: number[] = [];

      for (const item of textContent.items as {
        str: string;
        transform: number[];
        width: number;
        height: number;
        hasEOL?: boolean;
      }[]) {
        const str = item.str + (item.hasEOL ? '\n' : '');
        itemMappings.push({
          startIndex: fullText.length,
          endIndex: fullText.length + str.length,
          item,
        });

        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (!/\s/.test(char)) {
            // Normalize each character before adding to strippedText so that
            // ligatures, dashes, and smart quotes in the PDF match what the AI quoted.
            strippedText += normalizePdfText(char).toLowerCase();
            strippedToOriginal.push(fullText.length + i);
          }
        }
        fullText += str;
      }

      // Normalize the AI-provided quote the same way before comparing
      let strippedQuery = normalizePdfText(pending.quote).toLowerCase().replace(/\s+/g, '');

      if (!strippedQuery) continue;

      let matches = [];
      let index = 0;

      while ((index = strippedText.indexOf(strippedQuery, index)) !== -1) {
        matches.push(index);
        index += strippedQuery.length;
      }

      // If multiple matches, use context padding to disambiguate
      if (matches.length > 1 && pending.context_before && pending.context_after) {
        const strippedContextBefore = normalizePdfText(pending.context_before).toLowerCase().replace(/\s+/g, '');
        const strippedContextAfter = normalizePdfText(pending.context_after).toLowerCase().replace(/\s+/g, '');
        const expandedQuery = strippedContextBefore + strippedQuery + strippedContextAfter;
        let expandedIndex = strippedText.indexOf(expandedQuery);
        if (expandedIndex !== -1) {
          const quoteStartIndex = expandedIndex + strippedContextBefore.length;
          matches = [quoteStartIndex];
        }
      }

      if (matches.length === 1) {
        const strippedStart = matches[0];
        const strippedEnd = strippedStart + strippedQuery.length - 1;

        if (strippedStart < strippedToOriginal.length && strippedEnd < strippedToOriginal.length) {
          const matchStart = strippedToOriginal[strippedStart];
          const matchEnd = strippedToOriginal[strippedEnd] + 1;

          // Find which items overlap with the match
          const overlappingItems = itemMappings.filter((m) => m.startIndex < matchEnd && m.endIndex > matchStart);

          if (overlappingItems.length > 0) {
            foundRects = overlappingItems.map((m) => {
              const tx = m.item.transform;
              const x = tx[4];
              const y = pageHeight - tx[5]; // pdfjs y is from bottom
              const w = m.item.width;
              const h = m.item.height;
              return {
                x1: x,
                y1: y - h,
                x2: x + w,
                y2: y,
                width: pageWidth,
                height: pageHeight,
              };
            });
            foundPage = pageNum;
            break; // Stop searching other pages
          }
        }
      }
    }

    if (foundRects && foundPage > 0) {
      anchoredHighlights.push({
        pendingId: pending.id,
        content: { text: pending.quote },
        position: {
          boundingRect: foundRects[0], // approximate bounding rect using first item
          rects: foundRects,
          pageNumber: foundPage,
        },
        comment: { text: pending.comment || 'Destacado pela IA', emoji: '🤖' },
        color: '#fde047', // yellow
      });
    } else {
      unanchoredHighlights.push(pending);
    }
  }

  setStatus('');
  return { anchoredHighlights, unanchoredHighlights };
}
