import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron', () => ({ safeStorage: {} }));

import { DatabaseAdapter } from '../DatabaseAdapter';

type RepoName = 'projectRepo' | 'articleRepo' | 'articleCategoryRepo' | 'pdfLibraryRepo' | 'trashRepo';

/** [adapter method, repository it must forward to, arguments]. */
const DELEGATIONS: [keyof DatabaseAdapter, RepoName, unknown[]][] = [
  ['updateProjectWritingPad', 'projectRepo', [1, 'pad']],
  ['getProjectWritingPad', 'projectRepo', [1]],
  ['updateProject', 'projectRepo', [1, 'Nome']],
  ['getArticleCategories', 'articleCategoryRepo', [2]],
  ['getAllProjectArticleCategories', 'articleCategoryRepo', [1]],
  ['setArticleCategory', 'articleCategoryRepo', [2, 3, 'v']],
  ['getTrashItems', 'trashRepo', []],
  ['restoreTrashItem', 'trashRepo', ['article', 2]],
  ['deleteTrashItemPermanent', 'trashRepo', ['project', 1]],
  ['emptyTrash', 'trashRepo', []],
  ['getStoredPdfs', 'pdfLibraryRepo', []],
  ['getArticlesForPdf', 'pdfLibraryRepo', ['/a.pdf']],
  ['deletePdfRecord', 'pdfLibraryRepo', ['/a.pdf']],
  ['deletePdfLibraryRecord', 'pdfLibraryRepo', ['/a.pdf']],
  ['unlinkPdfFromArticle', 'pdfLibraryRepo', [2]],
  ['linkPdfToArticle', 'pdfLibraryRepo', [2, '/a.pdf']],
  ['registerPdfInLibrary', 'pdfLibraryRepo', ['/a.pdf', 'hash', 'a.pdf', 10]],
  ['getPdfByHash', 'pdfLibraryRepo', ['hash']],
  ['importArticlesFromProject', 'articleRepo', [1, 2, [3], 4]],
];

let adapter: DatabaseAdapter;

beforeEach(() => {
  adapter = new DatabaseAdapter(':memory:');
});

afterEach(() => {
  adapter.close();
  vi.restoreAllMocks();
});

describe('DatabaseAdapter forwards to its repositories', () => {
  it.each(DELEGATIONS)('%s → %s', (method, repoName, args) => {
    const repo = adapter[repoName] as unknown as Record<string, (...a: unknown[]) => unknown>;
    const target = vi.spyOn(repo, method as string).mockReturnValue('result');

    const result = (adapter[method] as (...a: unknown[]) => unknown)(...args);

    expect(target).toHaveBeenCalledWith(...args);
    expect(result).toBe('result');
  });
});
