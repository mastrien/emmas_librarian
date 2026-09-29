// Real SQLite and a temp userData folder: the service stores the PDF in the library and links it to the article.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const electron = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ safeStorage: {}, app: { getPath: () => electron.userData } }));

import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import { savePdfBytesToStorage } from '../../../ipc/handlers/pdfStorage';
import { OpenAccessService } from '../OpenAccessService';
import { BOT_CHECK_HTML, FakeWeb, PDF_BYTES } from './fakes/FakeWeb';

const DOI = '10.2337/dc11-s062';
const PMC_PDF = 'https://pmc-oa-opendata.s3.amazonaws.com/PMC3006051.1/PMC3006051.1.pdf';
const PUBLISHER_PDF = 'https://diabetesjournals.org/care/zdc10111000s62.pdf';

let workDir: string;
let db: DatabaseAdapter;
let web: FakeWeb;
let projectId: number;

const service = () =>
  new OpenAccessService({ db, http: web, storePdf: (bytes, name) => savePdfBytesToStorage(db, bytes, name) });
// Each article gets its own title: the project merges articles with the same title or DOI.
let articleCount = 0;
const addArticle = (doi: string | undefined, localFile?: string) => {
  const id = db.saveArticle(projectId, {
    title: `Artigo ${++articleCount}`,
    doi,
    source_query: 'q',
    source_databases: '[]',
    csl_json: '{}',
  });
  // saveArticle does not take a file; the app links one afterwards, like this.
  if (localFile) db.updateArticleFilePath(id, localFile);
  return id;
};
const workWith = (...locations: object[]) => ({ locations });
const publisher = {
  is_oa: true,
  pdf_url: PUBLISHER_PDF,
  landing_page_url: `https://doi.org/${DOI}`,
  source: { display_name: 'Diabetes Care', type: 'journal' },
};
const pmc = {
  is_oa: true,
  pdf_url: null,
  landing_page_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/3006051',
  source: { display_name: 'PubMed Central', type: 'repository' },
};

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-oa-'));
  electron.userData = workDir;
  db = new DatabaseAdapter(':memory:');
  projectId = db.createProject('Tese').id;
  web = new FakeWeb();
});

afterEach(() => {
  db.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('OpenAccessService.fetchForArticle', () => {
  it('skips the blocked publisher link, stores the PMC copy and links it to the article', async () => {
    web
      .onOpenAlexWork(DOI, workWith(publisher, pmc))
      .onPmcVersions('PMC3006051', [1])
      .on(PMC_PDF, PDF_BYTES)
      .on(PUBLISHER_PDF, BOT_CHECK_HTML);
    const articleId = addArticle(DOI);

    expect(await service().fetchForArticle(articleId)).toEqual({ status: 'downloaded', source: 'PubMed Central' });

    const linked = db.getArticle(articleId)!.local_file_path!;
    expect(fs.readFileSync(linked)).toEqual(PDF_BYTES);
    expect(path.basename(linked)).toMatch(/_10\.2337_dc11-s062\.pdf$/);
    expect(web.requested.map((r) => r.url)).not.toContain(PUBLISHER_PDF);
  });

  // The same paper under two DOIs (e.g. a preprint and a version of record) is stored once.
  it('reuses a PDF already in the library with the same content', async () => {
    const otherDoi = '10.1000/same-paper';
    web.onOpenAlexWork(DOI, workWith(pmc)).onOpenAlexWork(otherDoi, workWith(pmc));
    web.onPmcVersions('PMC3006051', [1]).on(PMC_PDF, PDF_BYTES);
    const first = addArticle(DOI);
    const second = addArticle(otherDoi);

    await service().fetchForArticle(first);
    await service().fetchForArticle(second);

    expect(db.getArticle(second)!.local_file_path).toBe(db.getArticle(first)!.local_file_path);
    expect(fs.readdirSync(path.join(workDir, 'storage', 'pdfs'))).toHaveLength(1);
  });

  it('says the copies are blocked, with their pages to open in the browser, when none hands over a PDF', async () => {
    web.onOpenAlexWork(DOI, workWith(publisher)).on(PUBLISHER_PDF, BOT_CHECK_HTML);
    const articleId = addArticle(DOI);

    expect(await service().fetchForArticle(articleId)).toEqual({
      status: 'blocked',
      landingPages: [`https://doi.org/${DOI}`],
    });
    expect(db.getArticle(articleId)!.local_file_path).toBeFalsy();
  });

  it('distinguishes no open copy, no DOI and an article that already has a PDF', async () => {
    web.onOpenAlexWork(
      DOI,
      workWith({ is_oa: false, pdf_url: null, landing_page_url: 'https://x', source: { type: 'journal' } }),
    );

    expect(await service().fetchForArticle(addArticle(DOI))).toEqual({ status: 'not-open' });
    expect(await service().fetchForArticle(addArticle(undefined))).toEqual({ status: 'no-doi' });
    expect(await service().fetchForArticle(addArticle(DOI, '/pdfs/tem.pdf'))).toEqual({ status: 'already' });
  });

  it('reports a failed OpenAlex lookup as a failure, not as "no open copy"', async () => {
    web.on(`https://api.openalex.org/works/doi:${encodeURIComponent(DOI)}?select=ids,locations,open_access`, 'x', 500);

    expect(await service().fetchForArticle(addArticle(DOI))).toEqual({
      status: 'failed',
      error: 'Erro 500 ao consultar a OpenAlex',
    });
  });

  it('names a missing article with its id', async () => {
    await expect(service().fetchForArticle(999)).rejects.toThrow('articleId=999');
  });
});
