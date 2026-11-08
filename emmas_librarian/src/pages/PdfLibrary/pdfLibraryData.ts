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
 * A size in the largest unit that keeps it at least 1, with up to two decimals.
 *
 * @example formatBytes(1536) // '1.5 KB'
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * When a PDF was added, as dd/mm/aaaa, hh:mm; "-" when unknown.
 *
 * @example formatAddedDate('2026-08-07T15:01:49') // '07/08/2026, 15:01'
 */
export function formatAddedDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
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
