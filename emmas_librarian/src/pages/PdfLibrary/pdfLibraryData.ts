/** A stored PDF as the library lists it, with the articles (and their projects) that use it. */
export interface PdfFileRecord {
  id: number;
  file_path: string;
  file_hash: string;
  filename: string;
  file_size: number;
  created_at: string;
  articles: Array<{
    article_id: number;
    article_title: string;
    project_id: number;
    project_name: string;
  }>;
}

/**
 * The day a PDF was added, as dd/mm/aaaa (board 171); "-" when unknown.
 *
 * @example formatAddedDay('2026-08-07T15:01:49') // '07/08/2026'
 */
export function formatAddedDay(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * The PDFs whose file name or one of whose articles' titles contains the search, ignoring case.
 *
 * @example filterPdfs(pdfs, 'era5')
 */
export function filterPdfs(pdfs: PdfFileRecord[], search: string): PdfFileRecord[] {
  const q = search.toLowerCase();
  return pdfs.filter(
    (pdf) =>
      pdf.filename.toLowerCase().includes(q) || pdf.articles.some((a) => a.article_title.toLowerCase().includes(q)),
  );
}

/**
 * The four numbers at the top of the library: files, total size, files reused by several articles, orphans.
 *
 * @example libraryMetrics(pdfs) // { total: 17, size: 134720000, shared: 0, orphans: 0 }
 */
export function libraryMetrics(pdfs: PdfFileRecord[]) {
  return {
    total: pdfs.length,
    size: pdfs.reduce((acc, pdf) => acc + pdf.file_size, 0),
    shared: pdfs.filter((p) => p.articles.length > 1).length,
    orphans: pdfs.filter((p) => p.articles.length === 0).length,
  };
}

export type PdfFilter = 'all' | 'shared' | 'orphans';

/**
 * The PDFs of a filter: all of them, those reused by several articles or those with no article.
 *
 * @example filterByUse(pdfs, 'orphans')
 */
export function filterByUse(pdfs: PdfFileRecord[], filter: PdfFilter): PdfFileRecord[] {
  if (filter === 'shared') return pdfs.filter((pdf) => pdf.articles.length > 1);
  if (filter === 'orphans') return pdfs.filter((pdf) => pdf.articles.length === 0);
  return pdfs;
}

export type PdfSort = 'size' | 'recent' | 'name';

export const PDF_SORTS: readonly { id: PdfSort; label: string }[] = [
  { id: 'size', label: 'Tamanho ↓' },
  { id: 'recent', label: 'Mais recentes' },
  { id: 'name', label: 'Nome' },
];

/**
 * The PDFs in the chosen order: the biggest first, the latest added first, or by file name.
 *
 * @example sortPdfs(pdfs, 'size')[0].file_size // the largest
 */
export function sortPdfs(pdfs: PdfFileRecord[], sort: PdfSort): PdfFileRecord[] {
  const sorted = [...pdfs];
  if (sort === 'name') return sorted.sort((a, b) => a.filename.localeCompare(b.filename, 'pt-BR', { numeric: true }));
  if (sort === 'recent') return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted.sort((a, b) => b.file_size - a.file_size);
}
