import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { setupIpcRegistries } from '../ipcRegistries';
import { IpcChannel } from '../../types';
import { harness, resetIpcHarness, invoke, rejectionPayload, PDF_DIR } from './fakes/ipcHarness';

vi.mock('electron', () => import('./fakes/ipcHarness').then((h) => h.electronModule));
vi.mock('fs', () => import('./fakes/ipcHarness').then((h) => h.fsModule));
vi.mock('../../database/DatabaseAdapter', () => import('./fakes/ipcHarness').then((h) => h.databaseAdapterModule));
vi.mock('../../database/ScientificVenueRepository', () => import('./fakes/ipcHarness').then((h) => h.venueRepositoryModule));
vi.mock('../../database/SyncService', () => import('./fakes/ipcHarness').then((h) => h.syncServiceModule));
vi.mock('../../services/SearchOrchestrator', () => import('./fakes/ipcHarness').then((h) => h.searchOrchestratorModule));
vi.mock('../../services/QueryTranslator', () => import('./fakes/ipcHarness').then((h) => h.queryTranslatorModule));
vi.mock('../../services/ApiIntegrator', () => import('./fakes/ipcHarness').then((h) => h.apiIntegratorModule));
vi.mock('../../services/ExportService', () => import('./fakes/ipcHarness').then((h) => h.exportServiceModule));
vi.mock('../../services/AIService', () => import('./fakes/ipcHarness').then((h) => h.aiServiceModule));
vi.mock('../../services/BackupService', () => import('./fakes/ipcHarness').then((h) => h.backupServiceModule));

const { db, disk } = harness;

beforeEach(() => {
  resetIpcHarness();
  setupIpcRegistries();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const silenceConsoleError = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

describe('PROJECTS_CREATE', () => {
  it('creates a project with a new name', async () => {
    db.getAllProjects.mockReturnValue([{ id: 1, name: 'Tese' }]);
    db.createProject.mockReturnValue({ id: 2, name: 'Artigo' });

    expect(await invoke(IpcChannel.PROJECTS_CREATE, 'Artigo')).toEqual({ id: 2, name: 'Artigo' });
    expect(db.createProject).toHaveBeenCalledWith('Artigo');
  });

  it('rejects names that differ only by case or surrounding spaces', async () => {
    db.getAllProjects.mockReturnValue([{ id: 1, name: '  Tese ' }]);

    const payload = await rejectionPayload(invoke(IpcChannel.PROJECTS_CREATE, 'tese  '));

    expect(payload.message).toBe(
      '[ERR_DUPLICATE_NAME] Já existe um projeto com este nome. Offending value: "tese  ". Expected shape: String de nome único entre os projetos cadastrados.',
    );
    expect(db.createProject).not.toHaveBeenCalled();
  });
});

describe('HIGHLIGHTS_CREATE', () => {
  it('saves the note as an annotation and links it to the highlight', async () => {
    db.saveAnnotation.mockReturnValue(11);
    db.saveHighlight.mockReturnValue(21);

    expect(await invoke(IpcChannel.HIGHLIGHTS_CREATE, 2, 'yellow', '{"p":1}', 'quote', 'my note')).toBe(21);
    expect(db.saveAnnotation).toHaveBeenCalledWith(2, 'my note');
    expect(db.saveHighlight).toHaveBeenCalledWith(2, 'yellow', '{"p":1}', 'quote', 11);
  });

  it('creates a bare highlight when there is no note', async () => {
    await invoke(IpcChannel.HIGHLIGHTS_CREATE, 2, 'yellow', '{}', null, '');

    expect(db.saveAnnotation).not.toHaveBeenCalled();
    expect(db.saveHighlight).toHaveBeenCalledWith(2, 'yellow', '{}', null, undefined);
  });
});

describe('SEARCH_EXECUTE in E2E mock mode', () => {
  beforeEach(() => {
    vi.stubEnv('E2E_MOCK_SEARCH', 'true');
    db.saveSearchHistory.mockReturnValue(5);
    db.getArticlesByProject.mockReturnValue([{ id: 99 }]);
  });

  it('persists one canned article instead of calling the search APIs', async () => {
    const result = await invoke(IpcChannel.SEARCH_EXECUTE, 1, { openalex: 'ml' }, 10, 'date', 'machine learning');

    expect(result).toEqual({ savedCount: 1, breakdown: { openalex: { count: 1 } }, articles: [{ id: 99 }] });
    expect(harness.orchestrator.searchAndPersist).not.toHaveBeenCalled();
    expect(db.saveSearchHistory).toHaveBeenCalledWith(1, 'machine learning', { openalex: 'ml' }, 1, { openalex: { count: 1 } });
    expect(db.saveArticle).toHaveBeenCalledWith(1, {
      doi: '10.1234/e2e-mock-doi',
      title: 'Aprendizado de Maquina E2E',
      authors: 'Author E2E',
      year: 2026,
      source_query: '{"openalex":"ml"}',
      source_databases: '["OpenAlex"]',
      csl_json: '{}',
      search_id: 5,
    });
  });

  it('labels the history entry when the query is empty', async () => {
    await invoke(IpcChannel.SEARCH_EXECUTE, 1, {}, 10, 'date', '');

    expect(db.saveSearchHistory).toHaveBeenCalledWith(1, 'E2E mock query', {}, 1, { openalex: { count: 1 } });
  });

  it('only activates for the exact value "true"', async () => {
    vi.stubEnv('E2E_MOCK_SEARCH', '1');

    await invoke(IpcChannel.SEARCH_EXECUTE, 1, {}, 10, 'date', 'q');

    expect(harness.orchestrator.searchAndPersist).toHaveBeenCalled();
    expect(db.saveArticle).not.toHaveBeenCalled();
  });
});

describe('ARTICLES_IMPORT_FROM_PROJECT', () => {
  it('records the import in the destination history and copies the articles', async () => {
    db.getProject.mockReturnValue({ id: 2, name: 'Fonte' });
    db.saveSearchHistory.mockReturnValue(77);

    expect(await invoke(IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, 2, 3, [5, 6])).toBe(77);
    expect(db.getProject).toHaveBeenCalledWith(2);
    expect(db.saveSearchHistory).toHaveBeenCalledWith(
      3,
      "Importação de artigos do projeto 'Fonte'",
      { import: 'Origem: Projeto ID 2' },
      2,
      { import: { count: 2 } },
    );
    expect(db.importArticlesFromProject).toHaveBeenCalledWith(2, 3, [5, 6], 77);
  });

  it('names the source by id when it no longer exists', async () => {
    db.getProject.mockReturnValue(undefined);

    await invoke(IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, 2, 3, [5]);

    expect(db.saveSearchHistory.mock.calls[0][1]).toBe("Importação de artigos do projeto 'Projeto ID 2'");
  });
});

describe('ARTICLES_CREATE_MANUAL', () => {
  const full = { title: 'T', authors: 'A. Autor', year: '2020', doi: '10.1/x', abstract: 'Resumo', journal: 'J' };

  beforeEach(() => {
    db.saveSearchHistory.mockReturnValue(4);
    db.saveArticle.mockReturnValue(12);
  });

  it('logs the addition and saves every provided field', async () => {
    expect(await invoke(IpcChannel.ARTICLES_CREATE_MANUAL, 1, full)).toBe(12);
    expect(db.saveSearchHistory).toHaveBeenCalledWith(1, 'Adição manual de artigo avulso: T', {}, 1, { Manual: { count: 1 } });
    expect(db.saveArticle).toHaveBeenCalledWith(1, {
      title: 'T',
      authors: 'A. Autor',
      year: 2020,
      doi: '10.1/x',
      abstract: 'Resumo',
      journal: 'J',
      source_query: 'Manual Import',
      source_databases: '["Manual"]',
      csl_json: '{}',
      search_id: 4,
    });
  });

  it('fills defaults for missing optional fields', async () => {
    await invoke(IpcChannel.ARTICLES_CREATE_MANUAL, 1, { title: 'Só título' });

    expect(db.saveArticle.mock.calls[0][1]).toMatchObject({
      authors: '',
      year: undefined,
      doi: undefined,
      abstract: undefined,
      journal: undefined,
    });
  });

  it('still saves the article when the history entry fails', async () => {
    const consoleError = silenceConsoleError();
    db.saveSearchHistory.mockImplementation(() => {
      throw new Error('disk full');
    });

    expect(await invoke(IpcChannel.ARTICLES_CREATE_MANUAL, 1, full)).toBe(12);
    expect(db.saveArticle.mock.calls[0][1]).toMatchObject({ search_id: undefined });
    expect(consoleError).toHaveBeenCalledWith('Failed to log manual article creation to search history:', expect.any(Error));
  });

  it('copies an attached PDF into storage and records its path', async () => {
    const source = path.join(path.sep, 'in', 'paper.pdf');
    disk.addFile(source, 'pdf');

    await invoke(IpcChannel.ARTICLES_CREATE_MANUAL, 1, full, source);

    const [articleId, destPath] = db.updateArticleFilePath.mock.calls[0];
    expect(articleId).toBe(12);
    expect(path.dirname(destPath)).toBe(PDF_DIR);
    expect(path.basename(destPath)).toMatch(/^12_\d+\.pdf$/);
    expect(disk.files.get(destPath)?.toString()).toBe('pdf');
  });

  it('keeps the article without a PDF when the copy fails', async () => {
    const consoleError = silenceConsoleError();

    expect(await invoke(IpcChannel.ARTICLES_CREATE_MANUAL, 1, full, path.join(path.sep, 'missing.pdf'))).toBe(12);
    expect(db.updateArticleFilePath).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Failed to copy PDF file for manual article:', expect.any(Error));
  });
});

describe('ARTICLES_CREATE_FROM_PDFS', () => {
  const first = path.join(path.sep, 'in', 'Deep Learning.pdf');
  const second = path.join(path.sep, 'in', 'survey.pdf');

  beforeEach(() => {
    disk.addFile(first, 'one');
    disk.addFile(second, 'two');
    db.saveSearchHistory.mockReturnValue(8);
    db.saveArticle.mockReturnValueOnce(31).mockReturnValueOnce(32);
  });

  it('creates one article per PDF, titled after the file, and links the stored copy', async () => {
    expect(await invoke(IpcChannel.ARTICLES_CREATE_FROM_PDFS, 1, [first, second])).toBe(2);
    expect(db.saveSearchHistory).toHaveBeenCalledWith(1, 'Importação em Lote de 2 PDFs', {}, 2, { Manual: { count: 2 } });
    expect(db.saveArticle).toHaveBeenNthCalledWith(1, 1, {
      title: 'Deep Learning',
      authors: '',
      source_query: 'Importação em Lote',
      source_databases: '["Manual"]',
      csl_json: '{}',
      search_id: 8,
    });
    expect(db.linkPdfToArticle.mock.calls.map(([id]) => id)).toEqual([31, 32]);
    const linkedPath = db.linkPdfToArticle.mock.calls[1][1];
    expect(disk.files.get(linkedPath)?.toString()).toBe('two');
  });

  it('does nothing for an empty selection', async () => {
    expect(await invoke(IpcChannel.ARTICLES_CREATE_FROM_PDFS, 1, [])).toBe(0);
    expect(db.saveSearchHistory).not.toHaveBeenCalled();
    expect(db.saveArticle).not.toHaveBeenCalled();
  });

  it('skips a file whose PDF cannot be stored, without creating an article for it', async () => {
    const consoleError = silenceConsoleError();

    expect(await invoke(IpcChannel.ARTICLES_CREATE_FROM_PDFS, 1, [path.join(path.sep, 'gone.pdf'), second])).toBe(1);
    expect(consoleError).toHaveBeenCalledWith('Failed to copy PDF file for batch import:', expect.any(Error));
    expect(db.saveArticle).toHaveBeenCalledTimes(1);
    expect(db.saveArticle.mock.calls[0][1]).toMatchObject({ title: 'survey' });
    expect(db.linkPdfToArticle).toHaveBeenCalledWith(31, expect.any(String));
  });

  it('imports without a history link when logging fails', async () => {
    const consoleError = silenceConsoleError();
    db.saveSearchHistory.mockImplementation(() => {
      throw new Error('locked');
    });

    expect(await invoke(IpcChannel.ARTICLES_CREATE_FROM_PDFS, 1, [first])).toBe(1);
    expect(db.saveArticle.mock.calls[0][1]).toMatchObject({ search_id: undefined });
    expect(consoleError).toHaveBeenCalledWith('Failed to log batch import to search history:', expect.any(Error));
  });
});
