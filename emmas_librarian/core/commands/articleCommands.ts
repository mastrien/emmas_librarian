import fs from 'fs';
import path from 'path';
import { IpcChannel, type Article } from '../../src/types';
import type { ArticleInput, DatabaseAdapter } from '../database/DatabaseAdapter';
import type { CommandRegistry } from './CommandRegistry';
import type { LibraryStorage } from '../services/LibraryStorage';
import { OUTSIDE_SEARCH_BASES } from '../../src/utils/outsideSearchEntries';

type ManualArticleData = Partial<Omit<Article, 'year'>> & { title: string; year?: string | number };

const { manual: MANUAL, projectImport: PROJECT_IMPORT } = OUTSIDE_SEARCH_BASES;
const MANUAL_SOURCES = JSON.stringify([MANUAL]);

/** What creating an article with a PDF needs: the database and where its files are kept. */
interface ArticleFiles {
  db: DatabaseAdapter;
  storage: LibraryStorage;
}

/**
 * Article queries, metadata/status updates, cross-project import and manual/PDF-based creation.
 *
 * Usage:
 *   registerArticleCommands(commands, db, storage);
 */
export function registerArticleCommands(commands: CommandRegistry, db: DatabaseAdapter, storage: LibraryStorage): void {
  commands.add(IpcChannel.ARTICLES_GET_BY_PROJECT, (projectId: number) => db.getArticlesByProject(projectId));
  commands.add(IpcChannel.ARTICLES_GET_ONE, (id: number) => db.getArticle(id));
  commands.add(IpcChannel.ARTICLES_UPDATE_STATUS, (id: number, status: Article['status'], note?: string) =>
    db.updateArticleStatus(id, status, note),
  );
  commands.add(IpcChannel.ARTICLES_UPDATE_STATUS_MANY, (ids: number[], status: Article['status'], note?: string) =>
    db.updateArticlesStatus(ids, status, note),
  );
  commands.add(IpcChannel.ARTICLES_UPDATE_METADATA, (id: number, data: Partial<ArticleInput>) =>
    db.updateArticleMetadata(id, data),
  );
  commands.add(IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, (sourceId: number, destId: number, articleIds: number[]) =>
    importFromProject(db, sourceId, destId, articleIds),
  );
  commands.add(
    IpcChannel.ARTICLES_CREATE_MANUAL,
    (projectId: number, data: ManualArticleData, sourceFilePath?: string) =>
      createManualArticle({ db, storage }, projectId, data, sourceFilePath),
  );
  commands.add(IpcChannel.ARTICLES_CREATE_FROM_PDFS, (projectId: number, filePaths: string[]) =>
    createArticlesFromPdfs({ db, storage }, projectId, filePaths),
  );
}

function importFromProject(db: DatabaseAdapter, sourceProjectId: number, destProjectId: number, articleIds: number[]) {
  const sourceName = db.getProject(sourceProjectId)?.name ?? `Projeto ID ${sourceProjectId}`;
  const searchId = db.saveSearchHistory(
    destProjectId,
    `Importação de artigos do projeto '${sourceName}'`,
    { [PROJECT_IMPORT]: `Origem: Projeto ID ${sourceProjectId}` },
    articleIds.length,
    { [PROJECT_IMPORT]: { count: articleIds.length } },
  );
  db.importArticlesFromProject(sourceProjectId, destProjectId, articleIds, searchId);
  // The copies come from another project of the app: the PRISMA diagram already knows where they came from (#50).
  db.tagPrismaSearchEntry(destProjectId, searchId, {
    name: `Projeto "${sourceName}"`,
    method: 'app_projects',
  });
  return searchId;
}

function createManualArticle(
  { db, storage }: ArticleFiles,
  projectId: number,
  data: ManualArticleData,
  sourceFilePath?: string,
) {
  const searchId = logToHistory('Failed to log manual article creation to search history:', () =>
    db.saveSearchHistory(projectId, `Adição manual de artigo avulso: ${data.title}`, {}, 1, { [MANUAL]: { count: 1 } }),
  );
  const articleId = db.saveArticle(projectId, {
    title: data.title,
    authors: data.authors || '',
    year: data.year ? parseInt(String(data.year)) : undefined,
    doi: data.doi || undefined,
    abstract: data.abstract || undefined,
    journal: data.journal || undefined,
    source_query: 'Manual Import',
    source_databases: MANUAL_SOURCES,
    csl_json: JSON.stringify({}),
    search_id: searchId,
  });
  if (sourceFilePath) attachCopiedPdf({ db, storage }, articleId, sourceFilePath);
  return articleId;
}

function attachCopiedPdf({ db, storage }: ArticleFiles, articleId: number, sourceFilePath: string): void {
  try {
    const destPath = path.join(storage.pdfsDir(), `${articleId}_${Date.now()}.pdf`);
    fs.copyFileSync(sourceFilePath, destPath);
    db.updateArticleFilePath(articleId, destPath);
  } catch (err) {
    console.error('Failed to copy PDF file for manual article:', err);
  }
}

function createArticlesFromPdfs(files: ArticleFiles, projectId: number, filePaths: string[]): number {
  const { db, storage } = files;
  const searchId =
    filePaths.length > 0
      ? logToHistory('Failed to log batch import to search history:', () =>
          db.saveSearchHistory(projectId, `Importação em Lote de ${filePaths.length} PDFs`, {}, filePaths.length, {
            [MANUAL]: { count: filePaths.length },
          }),
        )
      : undefined;
  storage.pdfsDir();
  return filePaths.filter((filePath) => importPdfAsArticle(files, projectId, filePath, searchId)).length;
}

// Store the PDF first so a failed copy never leaves an article without its file.
function importPdfAsArticle(
  { db, storage }: ArticleFiles,
  projectId: number,
  sourceFilePath: string,
  searchId?: number,
): boolean {
  try {
    const { destPath } = storage.savePdf(sourceFilePath);
    const articleId = db.saveArticle(projectId, {
      title: path.basename(sourceFilePath, '.pdf'),
      authors: '',
      source_query: 'Importação em Lote',
      source_databases: MANUAL_SOURCES,
      csl_json: JSON.stringify({}),
      search_id: searchId,
    });
    db.linkPdfToArticle(articleId, destPath);
    return true;
  } catch (err) {
    console.error('Failed to copy PDF file for batch import:', err);
    return false;
  }
}

// History entries are best-effort: a failure to log must not block the article itself.
function logToHistory(failureMessage: string, save: () => number): number | undefined {
  try {
    return save();
  } catch (err) {
    console.error(failureMessage, err);
    return undefined;
  }
}
