import type { HttpClient } from './httpClient';

// Highwire Press tags, which publishers put on article pages for Google Scholar; attribute order varies.
const CITATION_PDF_URL = [
  /<meta[^>]+name=["']citation_pdf_url["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']citation_pdf_url["']/i,
];

/**
 * The PDF link an article page declares in its `citation_pdf_url` meta tag, or null when the page does not
 * answer or has no such tag. OpenAlex often knows only the page of a gold open access article (Copernicus,
 * OJS journals), while the page itself points to the PDF.
 *
 * Usage:
 *   await pdfLinkFromLandingPage('https://doi.org/10.5194/gmd-19-5207-2026', fetchHttpClient);
 *   // 'https://gmd.copernicus.org/articles/19/5207/2026/gmd-19-5207-2026.pdf'
 */
export async function pdfLinkFromLandingPage(pageUrl: string, http: HttpClient): Promise<string | null> {
  const response = await http.get(pageUrl, { Accept: 'text/html' });
  if (!response.ok) return null;
  const html = await response.text();
  const link = CITATION_PDF_URL.map((pattern) => pattern.exec(html)?.[1]).find(Boolean);
  if (!link) return null;
  try {
    return new URL(link.replace(/&amp;/g, '&'), pageUrl).toString();
  } catch {
    return null;
  }
}
