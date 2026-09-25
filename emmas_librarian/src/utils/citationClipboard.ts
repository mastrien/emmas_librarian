import type { CitationOutputFormat } from '../services/citationService';

/** The slice of the Clipboard API used to copy citations. */
export interface CitationClipboard {
  write(items: ClipboardItem[]): Promise<void>;
  writeText(text: string): Promise<void>;
}

const CITATION_SEPARATOR = '\n\n';
const HTML_CITATION_SEPARATOR = '<br/><br/>';

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '');

async function copyRichCitations(citations: string[], clipboard: CitationClipboard) {
  const html = citations.join(HTML_CITATION_SEPARATOR);
  const plainText = citations.map(stripTags).join(CITATION_SEPARATOR);
  try {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
    });
    await clipboard.write([item]);
  } catch (err) {
    // Some Electron/Chromium builds reject ClipboardItem; plain text still pastes everywhere.
    console.error('Failed to copy rich text, falling back to plain text:', err);
    await clipboard.writeText(plainText);
  }
}

/**
 * Copies one or more generated citations, separated by a blank line.
 * HTML citations go out as rich text with a tag-free plain-text alternative.
 *
 * Usage:
 *   await copyCitations([citationHtml], 'html');
 */
export async function copyCitations(
  citations: string[],
  format: CitationOutputFormat,
  clipboard: CitationClipboard = navigator.clipboard,
): Promise<void> {
  if (format === 'html') return copyRichCitations(citations, clipboard);
  await clipboard.writeText(citations.join(CITATION_SEPARATOR));
}
