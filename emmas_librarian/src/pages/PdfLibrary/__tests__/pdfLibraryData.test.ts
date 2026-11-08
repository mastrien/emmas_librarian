import { describe, it, expect } from 'vitest';
import { filterPdfs, formatAddedDate, formatBytes, libraryMetrics, type PdfFileRecord } from '../pdfLibraryData';

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
  it('writes sizes in the largest whole unit', () => {
    expect([formatBytes(0), formatBytes(512), formatBytes(1536), formatBytes(10 * 1024 * 1024)]).toEqual([
      '0 Bytes',
      '512 Bytes',
      '1.5 KB',
      '10 MB',
    ]);
  });

  it('writes the added date with day, month, year and time, or a dash when missing', () => {
    expect(formatAddedDate('2026-08-07T15:01:00')).toBe('07/08/2026, 15:01');
    expect(formatAddedDate('')).toBe('-');
  });

  it('finds a PDF by its file name or an article title, ignoring case', () => {
    expect(filterPdfs(PDFS, 'ERA5').map((p) => p.filename)).toEqual(['era5.pdf']);
    expect(filterPdfs(PDFS, 'cópia').map((p) => p.filename)).toEqual(['worldclim.pdf']);
    expect(filterPdfs(PDFS, '')).toHaveLength(3);
  });

  it('counts files, space, reused PDFs and orphans', () => {
    expect(libraryMetrics(PDFS)).toEqual({ total: 3, size: 3584, shared: 1, orphans: 1 });
  });
});
