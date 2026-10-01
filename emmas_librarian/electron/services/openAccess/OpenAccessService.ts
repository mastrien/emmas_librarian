import type { OpenAccessOutcome } from '../../../src/types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { StoredPdf } from '../../ipc/handlers/pdfStorage';
import { doiKey } from '../../utils/doi';
import type { HttpClient } from './httpClient';
import { findOpenCopies, type OpenCopy } from './openCopies';
import { pdfLinkFromLandingPage } from './landingPagePdf';
import { downloadPdf } from './pdfDownload';

type ArticleStore = Pick<DatabaseAdapter, 'getArticle' | 'linkPdfToArticle' | 'getSetting'>;

export interface OpenAccessDeps {
  db: ArticleStore;
  http: HttpClient;
  /** Saves the bytes in the PDF library (deduplicated) and returns where. */
  storePdf: (bytes: Buffer, name: string) => StoredPdf;
}

// "10.2337/dc11-s062" → "10.2337_dc11-s062.pdf": readable in the PDF library, safe on every filesystem.
const fileNameFor = (doi: string) => `${doi.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`;

/**
 * Finds an open access copy of an article through OpenAlex (by DOI), tries the copies from the most to
 * the least reliable, and links the first real PDF to the article.
 *
 * Usage:
 *   const service = new OpenAccessService({ db, http: fetchHttpClient, storePdf: (b, n) => savePdfBytesToStorage(db, b, n) });
 *   await service.fetchForArticle(42); // { status: 'downloaded', source: 'PubMed Central' }
 */
export class OpenAccessService {
  constructor(private readonly deps: OpenAccessDeps) {}

  async fetchForArticle(articleId: number): Promise<OpenAccessOutcome> {
    const article = this.deps.db.getArticle(articleId);
    if (!article) {
      throw new Error(
        `[ERR_NOT_FOUND] Artigo não encontrado. Offending value: articleId=${articleId}. Expected shape: ID de um artigo existente.`,
      );
    }
    if (article.local_file_path) return { status: 'already' };
    const doi = doiKey(article.doi);
    if (!doi) return { status: 'no-doi' };
    try {
      return await this.downloadFirstCopy(articleId, doi);
    } catch (err) {
      return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async downloadFirstCopy(articleId: number, doi: string): Promise<OpenAccessOutcome> {
    const openAlexKey = this.deps.db.getSetting('openalex_api_key') || '';
    const { copies, landingPages } = await findOpenCopies(doi, this.deps.http, openAlexKey);
    if (copies.length === 0 && landingPages.length === 0) return { status: 'not-open' };
    for (const copy of copies) {
      if (await this.tryCopy(articleId, doi, copy)) return { status: 'downloaded', source: copy.source };
    }
    const fromPage = await this.tryLandingPages(articleId, doi, landingPages, copies);
    if (fromPage) return { status: 'downloaded', source: fromPage };
    return { status: 'blocked', landingPages: landingPages.length ? landingPages : copies.map((c) => c.url) };
  }

  // Last resort: the PDF link the article page declares; returns the site it came from, or null.
  private async tryLandingPages(
    articleId: number,
    doi: string,
    pages: string[],
    tried: OpenCopy[],
  ): Promise<string | null> {
    for (const page of pages) {
      const url = await pdfLinkFromLandingPage(page, this.deps.http).catch(() => null);
      if (!url || tried.some((c) => c.url === url)) continue;
      const source = new URL(url).hostname;
      if (await this.tryCopy(articleId, doi, { url, source, kind: 'publisher' })) return source;
    }
    return null;
  }

  // A copy that fails (network, bot check, too large) only means the next one is tried.
  private async tryCopy(articleId: number, doi: string, copy: OpenCopy): Promise<boolean> {
    const result = await downloadPdf(copy.url, this.deps.http).catch(() => ({ ok: false as const }));
    if (!result.ok) return false;
    const stored = this.deps.storePdf(result.bytes, fileNameFor(doi));
    this.deps.db.linkPdfToArticle(articleId, stored.destPath);
    return true;
  }
}
