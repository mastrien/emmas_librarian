import type { HttpClient } from './httpClient';

// A real PDF starts with these bytes; bot checks and landing pages answer HTML under a ".pdf" URL.
const PDF_MAGIC = Buffer.from('%PDF-');
const MAX_BYTES = 50 * 1024 * 1024;

export type PdfDownload = { ok: true; bytes: Buffer } | { ok: false; reason: string };

/**
 * Downloads `url` and accepts it only when the body really is a PDF (starts with "%PDF-") and is at most
 * 50 MB; otherwise says why, so the caller can try the next copy.
 *
 * Usage:
 *   const result = await downloadPdf('https://arxiv.org/pdf/2609.32552', fetchHttpClient);
 *   if (result.ok) savePdfBytesToStorage(db, result.bytes, 'paper.pdf');
 */
export async function downloadPdf(url: string, http: HttpClient): Promise<PdfDownload> {
  const response = await http.get(url, { Accept: 'application/pdf' });
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
  const declared = Number(response.header('Content-Length') ?? 0);
  if (declared > MAX_BYTES) return { ok: false, reason: 'arquivo maior que 50 MB' };
  const bytes = await response.bytes();
  if (bytes.length > MAX_BYTES) return { ok: false, reason: 'arquivo maior que 50 MB' };
  if (!bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC))
    return { ok: false, reason: 'a página não entregou um PDF' };
  return { ok: true, bytes };
}
