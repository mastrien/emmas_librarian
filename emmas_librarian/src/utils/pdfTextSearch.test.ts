import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist';
import { anchorPendingHighlights } from './pdfTextSearch';
import { PendingHighlight } from '../types';

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
}));

interface FakeItem {
  str: string;
  hasEOL?: boolean;
  transform: number[];
  width: number;
  height: number;
}

class FakePage {
  constructor(private textOrItems: string | FakeItem[], private hasEOL: boolean = false) {}

  getViewport() {
    return { width: 800, height: 1000 };
  }

  async getTextContent() {
    if (typeof this.textOrItems === 'string') {
      return {
        items: [
          {
            str: this.textOrItems,
            hasEOL: this.hasEOL,
            transform: [1, 0, 0, 1, 50, 100], // [a, b, c, d, x, y]
            width: 200,
            height: 12,
          },
        ],
      };
    } else {
      return { items: this.textOrItems };
    }
  }
}

class FakePdfDoc {
  numPages: number;
  private pages: FakePage[];

  constructor(pages: FakePage[]) {
    this.pages = pages;
    this.numPages = pages.length;
  }

  async getPage(pageNum: number) {
    return this.pages[pageNum - 1];
  }
}

describe('pdfTextSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('anchorPendingHighlights', () => {
    it('returns empty arrays if pendingHighlights is empty', async () => {
      const setStatus = vi.fn();
      const result = await anchorPendingHighlights('test.pdf', [], setStatus);
      expect(result).toEqual({ anchoredHighlights: [], unanchoredHighlights: [] });
      expect(setStatus).not.toHaveBeenCalled();
    });

    it('returns unanchored if quote is empty', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('Hello world')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 1,
        article_id: 1,
        created_at: '',
        quote: '', // Empty quote
        comment: 'Empty',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.unanchoredHighlights).toHaveLength(0);
      expect(result.anchoredHighlights).toHaveLength(0);
    });

    it('anchors a highlight when an exact match is found', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('This is a simple test document')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 1,
        article_id: 1,
        created_at: '',
        quote: 'simple test',
        comment: 'Found it',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      
      expect(result.unanchoredHighlights).toHaveLength(0);
      expect(result.anchoredHighlights).toHaveLength(1);
      expect(result.anchoredHighlights[0].content.text).toBe('simple test');
      expect(result.anchoredHighlights[0].position.pageNumber).toBe(1);
      
      // Checking bounding rect based on FakePage transform [1, 0, 0, 1, 50, 100], height: 12, pageHeight: 1000
      // x = 50, y = 1000 - 100 = 900
      // y1 = 900 - 12 = 888, y2 = 900, x1 = 50, x2 = 250
      expect(result.anchoredHighlights[0].position.boundingRect).toEqual({
        x1: 50,
        y1: 888,
        x2: 250,
        y2: 900,
        width: 800,
        height: 1000,
      });
      expect(result.anchoredHighlights[0].color).toBe('#fde047');
      expect(result.anchoredHighlights[0].comment).toEqual({ text: 'Found it', emoji: '🤖' });
      expect(setStatus).toHaveBeenLastCalledWith('');
    });

    it('normalizes ligatures, dashes and quotes for matching', async () => {
      const setStatus = vi.fn();
      // "ﬁ" -> "fi", en dash -> hyphen, curly quote -> straight quote
      const mockDoc = new FakePdfDoc([new FakePage('The ﬁne art – it’s great')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 2,
        article_id: 1,
        created_at: '',
        // Request uses normalized or different variations
        quote: "The fine art - it's great",
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
      expect(result.unanchoredHighlights).toHaveLength(0);
      expect(result.anchoredHighlights[0].comment).toEqual({ text: 'Destacado pela IA', emoji: '🤖' });
      expect(setStatus).toHaveBeenLastCalledWith('');
    });

    it('uses context to disambiguate multiple matches', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('apple banana cherry apple date')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 3,
        article_id: 1,
        created_at: '',
        quote: 'apple',
        comment: '',
        context_before: 'cherry',
        context_after: 'date', // Should match the second apple
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
      expect(result.unanchoredHighlights).toHaveLength(0);
    });

    it('returns unanchored if match is not found', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('Some text here')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 4,
        article_id: 1,
        created_at: '',
        quote: 'missing text',
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(0);
      expect(result.unanchoredHighlights).toHaveLength(1);
    });

    it('handles hasEOL=true correctly', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('Line 1', true)]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 5,
        article_id: 1,
        created_at: '',
        quote: 'Line 1\n', // Because FakePage adds '\n' if hasEOL is true
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
    });

    it('returns unanchored if quote contains only spaces/invisible chars', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('Some text')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 6,
        article_id: 1,
        created_at: '',
        quote: '   ', // Only spaces
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.unanchoredHighlights).toHaveLength(1);
    });

    it('handles multiple items and accurately computes rects for overlapping items', async () => {
      const setStatus = vi.fn();
      const items: FakeItem[] = [
        { str: 'hello worl', hasEOL: false, transform: [1, 0, 0, 1, 10, 100], width: 90, height: 12 }, // start 0, end 10
        { str: 'd', hasEOL: false, transform: [1, 0, 0, 1, 100, 100], width: 10, height: 12 }          // start 10, end 11
      ];
      const mockDoc = new FakePdfDoc([new FakePage(items)]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 7,
        article_id: 1,
        created_at: '',
        quote: 'hello world',
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
      // Both items must be included. If strippedEnd computation is off by -1, 'd' is skipped.
      expect(result.anchoredHighlights[0].position.rects).toHaveLength(2);
      
      const rects = result.anchoredHighlights[0].position.rects;
      expect(rects[0]).toEqual({ x1: 10, y1: 888, x2: 100, y2: 900, width: 800, height: 1000 });
      expect(rects[1]).toEqual({ x1: 100, y1: 888, x2: 110, y2: 900, width: 800, height: 1000 });
    });

    it('does not include adjacent items that do not overlap', async () => {
      const setStatus = vi.fn();
      // To catch off-by-one errors in `matchEnd` (like +1 becoming +2),
      // we need the adjacent items to start exactly at the boundary.
      const items: FakeItem[] = [
        { str: 'prefix', hasEOL: false, transform: [1, 0, 0, 1, 10, 100], width: 60, height: 12 }, // 0 to 6
        { str: 'm', hasEOL: false, transform: [1, 0, 0, 1, 70, 100], width: 10, height: 12 },      // 6 to 7
        { str: 'atch', hasEOL: false, transform: [1, 0, 0, 1, 80, 100], width: 40, height: 12 },   // 7 to 11
        { str: 'suffix', hasEOL: false, transform: [1, 0, 0, 1, 120, 100], width: 60, height: 12 } // 11 to 17
      ];
      const mockDoc = new FakePdfDoc([new FakePage(items)]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 8,
        article_id: 1,
        created_at: '',
        quote: 'match',
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
      // ONLY 'm' and 'atch' should be included. Length 2.
      expect(result.anchoredHighlights[0].position.rects).toHaveLength(2);
      expect(result.anchoredHighlights[0].position.rects[0]).toEqual({ x1: 70, y1: 888, x2: 80, y2: 900, width: 800, height: 1000 });
    });

    it('handles undefined pendingHighlights gracefully', async () => {
      const setStatus = vi.fn();
      const result = await anchorPendingHighlights('test.pdf', undefined as any, setStatus);
      expect(result).toEqual({ anchoredHighlights: [], unanchoredHighlights: [] });
    });

    it('handles overlapping index matches when query repeats', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('aaaa')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 11,
        article_id: 1,
        created_at: '',
        quote: 'aa',
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      // 2 matches found without context, so it fails to anchor.
      expect(result.unanchoredHighlights).toHaveLength(1);
    });

    it('ignores context if there is exactly one match', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('unique string here')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 12,
        article_id: 1,
        created_at: '',
        quote: 'unique string',
        comment: '',
        context_before: 'wrong context',
        context_after: 'also wrong',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
    });

    it('returns unanchored if multiple matches but context does not help disambiguate', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([new FakePage('apple banana apple')]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 13,
        article_id: 1,
        created_at: '',
        quote: 'apple',
        comment: '',
        context_before: 'wrong',
        context_after: 'context',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(0);
      expect(result.unanchoredHighlights).toHaveLength(1);
    });

    it('anchors correctly when the match is at the very beginning of the document', async () => {
      const setStatus = vi.fn();
      const items: FakeItem[] = [
        { str: 'start text', hasEOL: false, transform: [1, 0, 0, 1, 10, 100], width: 100, height: 12 },
        { str: ' more text', hasEOL: false, transform: [1, 0, 0, 1, 110, 100], width: 100, height: 12 }
      ];
      const mockDoc = new FakePdfDoc([new FakePage(items)]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 14,
        article_id: 1,
        created_at: '',
        quote: 'start text',
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
      expect(result.anchoredHighlights[0].position.rects).toHaveLength(1);
    });

    it('anchors correctly when the match is at the very end of the document', async () => {
      const setStatus = vi.fn();
      const items: FakeItem[] = [
        { str: 'some text ', hasEOL: false, transform: [1, 0, 0, 1, 10, 100], width: 100, height: 12 },
        { str: 'end', hasEOL: false, transform: [1, 0, 0, 1, 110, 100], width: 30, height: 12 }
      ];
      const mockDoc = new FakePdfDoc([new FakePage(items)]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 15,
        article_id: 1,
        created_at: '',
        quote: 'end',
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
      expect(result.anchoredHighlights[0].position.rects).toHaveLength(1);
    });

    it('searches all pages and finds match on the last page', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([
        new FakePage('page one text'),
        new FakePage('page two text'),
        new FakePage('page three text')
      ]);
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 9,
        article_id: 1,
        created_at: '',
        quote: 'page three text',
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(1);
      expect(result.anchoredHighlights[0].position.pageNumber).toBe(3);
    });

    it('returns unanchored when no pages match', async () => {
      const setStatus = vi.fn();
      const mockDoc = new FakePdfDoc([]); // zero pages!
      (pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(mockDoc) });

      const pending: PendingHighlight = {
        id: 10,
        article_id: 1,
        created_at: '',
        quote: 'anything',
        comment: '',
        context_before: '',
        context_after: '',
      };

      const result = await anchorPendingHighlights('test.pdf', [pending], setStatus);
      expect(result.anchoredHighlights).toHaveLength(0);
      expect(result.unanchoredHighlights).toHaveLength(1);
    });
  });
});
