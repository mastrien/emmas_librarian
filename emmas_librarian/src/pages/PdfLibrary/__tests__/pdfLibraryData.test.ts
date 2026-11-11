import { describe, it, expect } from 'vitest';
import {
  filterByUse,
  filterPdfs,
  formatAddedDay,
  libraryMetrics,
  sortPdfs,
  type PdfFileRecord,
} from '../pdfLibraryData';

const pdf = (filename: string, size: number, titles: string[]): PdfFileRecord => ({
  id: 1,
  file_path: `/pdfs/${filename}`,
  file_hash: filename,
  filename,
  file_size: size,
  created_at: '2026-08-07 15:01:49',
  articles: titles.map((article_title, i) => ({ article_id: i, article_title, project_id: 1, project_name: 'P' })),
});

const PDFS = [
  pdf('era5.pdf', 2048, ['The ERA5 global reanalysis']),
  pdf('worldclim.pdf', 1024, ['WorldClim 2', 'WorldClim 2 (cópia)']),
  pdf('orfao.pdf', 512, []),
];

describe('PDF library data (Arca 134)', () => {
  it('writes the added day as dd/mm/aaaa, or a dash when missing', () => {
    expect(formatAddedDay('2026-08-07T15:01:00')).toBe('07/08/2026');
    expect(formatAddedDay('')).toBe('-');
  });

  it('finds a PDF by its file name or an article title, ignoring case', () => {
    expect(filterPdfs(PDFS, 'ERA5').map((p) => p.filename)).toEqual(['era5.pdf']);
    expect(filterPdfs(PDFS, 'cópia').map((p) => p.filename)).toEqual(['worldclim.pdf']);
    expect(filterPdfs(PDFS, '')).toHaveLength(3);
  });

  it('counts files, space, reused PDFs and orphans', () => {
    expect(libraryMetrics(PDFS)).toEqual({ total: 3, size: 3584, shared: 1, orphans: 1 });
  });

  it('keeps the reused PDFs or the orphans when a filter is chosen', () => {
    expect(filterByUse(PDFS, 'shared').map((p) => p.filename)).toEqual(['worldclim.pdf']);
    expect(filterByUse(PDFS, 'orphans').map((p) => p.filename)).toEqual(['orfao.pdf']);
    expect(filterByUse(PDFS, 'all')).toHaveLength(3);
  });

  it('orders by size (largest first), by recency or by name without changing the input', () => {
    const recent = { ...PDFS[2], created_at: '2026-09-01 10:00:00' };
    const list = [PDFS[1], recent, PDFS[0]];
    expect(sortPdfs(list, 'size').map((p) => p.filename)).toEqual(['era5.pdf', 'worldclim.pdf', 'orfao.pdf']);
    expect(sortPdfs(list, 'recent')[0].filename).toBe('orfao.pdf');
    expect(sortPdfs(list, 'name').map((p) => p.filename)).toEqual(['era5.pdf', 'orfao.pdf', 'worldclim.pdf']);
    expect(list[0].filename).toBe('worldclim.pdf');
  });
});
