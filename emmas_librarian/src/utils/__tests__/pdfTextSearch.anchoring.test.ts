import { describe, it, expect, vi } from 'vitest';
import {
  anchorQuote,
  buildPageIndex,
  locateQuote,
  quoteSegments,
  stripForMatching,
  type AnchoringPdfDocument,
  type PdfTextItem,
} from '../pdfTextSearch';

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn() }));

// One text item per line, as pdf.js gives a typeset paragraph: each line ends with hasEOL.
function lines(...texts: string[]): PdfTextItem[] {
  return texts.map((str, i) => ({
    str,
    hasEOL: true,
    transform: [1, 0, 0, 1, 50, 700 - i * 14],
    width: 300,
    height: 12,
  }));
}

class FakeAnchoringDoc implements AnchoringPdfDocument {
  constructor(private pages: PdfTextItem[][]) {}
  get numPages() {
    return this.pages.length;
  }
  async getPage(n: number) {
    const items = this.pages[n - 1];
    return { getViewport: () => ({ width: 600, height: 800 }), getTextContent: async () => ({ items }) };
  }
}

const locate = (items: PdfTextItem[], quote: string) => locateQuote(buildPageIndex(items).stripped, quote);

// Regression for the AI quotes that never became highlights (precipitation project, 2026-10): 45 of 67 had turned
// into "[Destaque não ancorado]" notes, mostly from line-end hyphenation and from "..." the AI put in its quotes.
describe('anchoring AI quotes the PDF typesets differently', () => {
  it('finds a quote whose word the PDF breaks with a hyphen at the end of a line', () => {
    const page = lines('generate highly accurate precipitation forecas-', 'ts for the region.');

    expect(locate(page, 'generate highly accurate precipitation forecasts for the region')).not.toBeNull();
  });

  it('keeps finding quotes with real hyphens when the PDF also breaks a line', () => {
    const page = lines('Applying AI-driven post-pro-', 'cessing to forecasting models');

    expect(locate(page, 'Applying AI-driven post-processing to forecasting models')).not.toBeNull();
  });

  it('treats the Unicode hyphen the AI copies (U+2010) like the PDF’s', () => {
    const page = lines('a semi-arid Mediterranean environment');

    expect(locate(page, 'a semi‐arid Mediterranean environment')).not.toBeNull();
  });

  it('finds a quote the AI shortened with "...", part after part on the same page', () => {
    const page = lines(
      'We utilize the daily-averaged data spanning from 1996 to 2022 in the China',
      'region (14.75°N, 69.75°E) from ERA5 reanalysis dataset, and preprocess them.',
    );

    const ranges = locate(
      page,
      'We utilize the daily-averaged data spanning from 1996 to 2022 ... from ERA5 reanalysis dataset',
    );

    expect(ranges).toHaveLength(2);
    expect(ranges![0].end).toBeLessThan(ranges![1].start);
  });

  it('does not stitch "..." parts found out of order', () => {
    const page = lines('from ERA5 reanalysis dataset first,', 'then we utilize the daily-averaged data.');

    expect(locate(page, 'we utilize the daily-averaged data ... from ERA5 reanalysis dataset')).toBeNull();
  });

  it.each([
    [
      'closes with a period a sentence the text goes on with',
      'under climate variability (Fig. 2). To ensure',
      'under climate variability.',
    ],
    ['drops a comma', 'Author contributions. Y.W., S.H., and Q.L. conceived', 'Y.W., S.H. and Q.L. conceived'],
    ['writes other quote marks', "the ''Stage II'' hourly radar composites", 'the "Stage II" hourly radar composites'],
  ])('finds a quote where the AI %s', (_case, pdfText, quote) => {
    expect(locate(lines(pdfText), quote)).not.toBeNull();
  });

  it('still refuses text that is not on the page', () => {
    expect(locate(lines('precipitation forecasts'), 'temperature forecasts')).toBeNull();
  });
});

describe('quote parts', () => {
  it('drops parts too short to locate and keeps the order', () => {
    expect(quoteSegments('Daily rainfall data ... (Fig. 1) ... were averaged per basin')).toEqual([
      'dailyrainfalldata',
      'wereaveragedperbasin',
    ]);
  });

  it('uses the whole quote when every part is short, or there is no ellipsis', () => {
    expect(quoteSegments('et al. ... 2011')).toEqual(['etal2011']);
    expect(quoteSegments('Precipi-tação  Média')).toEqual([stripForMatching('Precipitação Média')]);
  });
});

describe('anchorQuote', () => {
  it('returns the page and the rectangles of every line the quote covers', async () => {
    const doc = new FakeAnchoringDoc([
      lines('nothing here'),
      lines('accurate precipitation forecas-', 'ts for the region.'),
    ]);

    const anchor = await anchorQuote(doc, 'precipitation forecasts for the region');

    expect(anchor?.pageNumber).toBe(2);
    expect(anchor?.rects).toHaveLength(2);
    expect(anchor?.rects[0]).toMatchObject({ x1: 50, width: 600, height: 800 });
  });

  it('returns null when no page has the quote', async () => {
    expect(await anchorQuote(new FakeAnchoringDoc([lines('a b c')]), 'precipitation')).toBeNull();
  });
});
