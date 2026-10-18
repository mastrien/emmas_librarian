import { describe, it, expect, vi } from 'vitest';
import { retryAnchorNote, type RetryAnchorDeps } from '../retryAnchorNote';
import { unanchoredNoteMarkdown, parseUnanchoredNote, isUnanchoredNote } from '../../../utils/unanchoredNote';
import type { AnchoringPdfDocument, PdfTextItem } from '../../../utils/pdfTextSearch';
import type { Annotation } from '../../../types';

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn() }));

class FakeAnchoringDoc implements AnchoringPdfDocument {
  constructor(private lines: string[]) {}
  numPages = 1;
  async getPage() {
    const items: PdfTextItem[] = this.lines.map((str, i) => ({
      str,
      hasEOL: true,
      transform: [1, 0, 0, 1, 40, 700 - i * 14],
      width: 300,
      height: 12,
    }));
    return { getViewport: () => ({ width: 600, height: 800 }), getTextContent: async () => ({ items }) };
  }
}

class RecordingReaderStore implements RetryAnchorDeps {
  public calls: string[] = [];
  public highlights: unknown[][] = [];
  constructor(private doc: AnchoringPdfDocument) {}
  openPdf = async () => this.doc;
  createHighlight = async (...args: unknown[]) => {
    this.calls.push('createHighlight');
    this.highlights.push(args);
  };
  deleteAnnotation = async (id: number) => {
    this.calls.push(`deleteAnnotation:${id}`);
  };
}

const note = (content: string): Annotation => ({ id: 9, article_id: 4, content_markdown: content, created_at: '' });
const comment = 'Pergunta: Qual a base?\n\nResposta: ERA5';

describe('unanchored AI notes', () => {
  it('reads back the comment and the quote the reader wrote, across lines', () => {
    const markdown = unanchoredNoteMarkdown(comment, 'linha um\nlinha "dois"');

    expect(isUnanchoredNote(markdown)).toBe(true);
    expect(parseUnanchoredNote(markdown)).toEqual({ comment, quote: 'linha um\nlinha "dois"' });
  });

  it('is not one of the person’s own notes', () => {
    expect(isUnanchoredNote('Minha nota sobre o método')).toBe(false);
    expect(parseUnanchoredNote('[Destaque não ancorado] editada à mão')).toBeNull();
  });
});

describe('retryAnchorNote', () => {
  it('creates the highlight with the note’s comment first, then removes the note', async () => {
    const store = new RecordingReaderStore(
      new FakeAnchoringDoc(['accurate precipitation forecas-', 'ts for the region.']),
    );

    const outcome = await retryAnchorNote(
      4,
      'blob:pdf',
      note(unanchoredNoteMarkdown(comment, 'precipitation forecasts')),
      store,
    );

    expect(outcome).toBe('anchored');
    expect(store.calls).toEqual(['createHighlight', 'deleteAnnotation:9']);
    const [articleId, color, position, text, annotation] = store.highlights[0];
    expect([articleId, color, text, annotation]).toEqual([4, '#fde047', 'precipitation forecasts', comment]);
    expect(position).toMatchObject({ pageNumber: 1 });
  });

  it('keeps the note when the quote still is not in the PDF', async () => {
    const store = new RecordingReaderStore(new FakeAnchoringDoc(['nothing like it']));

    expect(await retryAnchorNote(4, 'blob:pdf', note(unanchoredNoteMarkdown(comment, 'precipitation')), store)).toBe(
      'not-found',
    );
    expect(store.calls).toEqual([]);
  });

  it('keeps a note edited out of its original shape', async () => {
    const store = new RecordingReaderStore(new FakeAnchoringDoc(['x']));

    expect(await retryAnchorNote(4, 'blob:pdf', note('[Destaque não ancorado] reescrita'), store)).toBe(
      'unreadable-note',
    );
    expect(store.calls).toEqual([]);
  });
});
