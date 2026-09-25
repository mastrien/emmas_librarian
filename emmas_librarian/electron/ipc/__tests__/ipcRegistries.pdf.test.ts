import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import crypto from 'crypto';
import { setupIpcRegistries } from '../ipcRegistries';
import { IpcChannel } from '../../types';
import { harness, resetIpcHarness, invoke, rejectionPayload, PDF_DIR } from './fakes/ipcHarness';

vi.mock('electron', () => import('./fakes/ipcHarness').then((h) => h.electronModule));
vi.mock('fs', () => import('./fakes/ipcHarness').then((h) => h.fsModule));
vi.mock('../../database/DatabaseAdapter', () => import('./fakes/ipcHarness').then((h) => h.databaseAdapterModule));
vi.mock('../../database/ScientificVenueRepository', () =>
  import('./fakes/ipcHarness').then((h) => h.venueRepositoryModule),
);
vi.mock('../../database/SyncService', () => import('./fakes/ipcHarness').then((h) => h.syncServiceModule));
vi.mock('../../services/SearchOrchestrator', () =>
  import('./fakes/ipcHarness').then((h) => h.searchOrchestratorModule),
);
vi.mock('../../services/QueryTranslator', () => import('./fakes/ipcHarness').then((h) => h.queryTranslatorModule));
vi.mock('../../services/ApiIntegrator', () => import('./fakes/ipcHarness').then((h) => h.apiIntegratorModule));
vi.mock('../../services/ExportService', () => import('./fakes/ipcHarness').then((h) => h.exportServiceModule));
vi.mock('../../services/AIService', () => import('./fakes/ipcHarness').then((h) => h.aiServiceModule));
vi.mock('../../services/BackupService', () => import('./fakes/ipcHarness').then((h) => h.backupServiceModule));

const { disk, db } = harness;
const SOURCE = path.join(path.sep, 'downloads', 'my paper (v2).pdf');
const CONTENT = 'pdf-bytes';
const HASH = crypto.createHash('sha256').update(Buffer.from(CONTENT)).digest('hex');
const STORED_NAME = /^\d{4}-\d{2}-\d{2}_\d{6}_my_paper__v2_\.pdf$/;

beforeEach(() => {
  resetIpcHarness();
  setupIpcRegistries();
  disk.addFile(SOURCE, CONTENT);
});

describe('PDF library storage (PDF_LIBRARY_UPLOAD)', () => {
  it('copies a new PDF into the library under a timestamped, sanitized name and registers it', async () => {
    const destPath = (await invoke(IpcChannel.PDF_LIBRARY_UPLOAD, SOURCE)) as string;

    expect(path.dirname(destPath)).toBe(PDF_DIR);
    expect(path.basename(destPath)).toMatch(STORED_NAME);
    expect(disk.dirs.has(PDF_DIR)).toBe(true);
    expect(disk.files.get(destPath)?.toString()).toBe(CONTENT);
    expect(db.getPdfByHash).toHaveBeenCalledWith(HASH);
    expect(db.registerPdfInLibrary).toHaveBeenCalledWith(destPath, HASH, path.basename(destPath), CONTENT.length);
    expect(db.linkPdfToArticle).not.toHaveBeenCalled();
  });

  it('reuses the stored copy when the same content was already imported', async () => {
    const existing = path.join(PDF_DIR, 'old_name.pdf');
    disk.addFile(existing, CONTENT);
    db.getPdfByHash.mockReturnValue({ file_path: existing, filename: 'Old Name.pdf' });

    const destPath = await invoke(IpcChannel.PDF_LIBRARY_UPLOAD, SOURCE);

    expect(destPath).toBe(existing);
    expect(disk.files.size).toBe(2);
    expect(db.registerPdfInLibrary).toHaveBeenCalledWith(existing, HASH, 'Old Name.pdf', CONTENT.length);
  });

  it('falls back to the stored basename when the record has no filename', async () => {
    const existing = path.join(PDF_DIR, 'stored.pdf');
    disk.addFile(existing, CONTENT);
    db.getPdfByHash.mockReturnValue({ file_path: existing, filename: null });

    await invoke(IpcChannel.PDF_LIBRARY_UPLOAD, SOURCE);

    expect(db.registerPdfInLibrary).toHaveBeenCalledWith(existing, HASH, 'stored.pdf', CONTENT.length);
  });

  it.each([
    ['its file is gone from disk', { file_path: path.join(PDF_DIR, 'gone.pdf'), filename: 'gone.pdf' }],
    ['it has no file path', { file_path: null, filename: 'x.pdf' }],
  ])('stores a fresh copy when a matching record exists but %s', async (_label, record) => {
    db.getPdfByHash.mockReturnValue(record);

    const destPath = (await invoke(IpcChannel.PDF_LIBRARY_UPLOAD, SOURCE)) as string;

    expect(path.basename(destPath)).toMatch(STORED_NAME);
    expect(disk.files.get(destPath)?.toString()).toBe(CONTENT);
  });

  it('reports a missing source file', async () => {
    const payload = await rejectionPayload(invoke(IpcChannel.PDF_LIBRARY_UPLOAD, path.join(path.sep, 'nope.pdf')));

    expect(payload.code).toBe('ERR_INTERNAL');
    expect(payload.message).toContain('ENOENT');
  });
});

describe('PDF_UPLOAD', () => {
  it('stores the file and links it to the article', async () => {
    const destPath = await invoke(IpcChannel.PDF_UPLOAD, 7, SOURCE);

    expect(db.linkPdfToArticle).toHaveBeenCalledWith(7, destPath);
    expect(disk.files.has(destPath as string)).toBe(true);
  });
});

describe('PDF_GET', () => {
  it("returns the article's PDF bytes", async () => {
    const stored = path.join(PDF_DIR, 'a.pdf');
    disk.addFile(stored, CONTENT);
    db.getArticle.mockReturnValue({ id: 2, local_file_path: stored });

    const buffer = (await invoke(IpcChannel.PDF_GET, 2)) as Buffer;

    expect(buffer.toString()).toBe(CONTENT);
    expect(db.getArticle).toHaveBeenCalledWith(2);
  });

  it.each([
    ['the article does not exist', undefined],
    ['the article has no PDF', { id: 2, local_file_path: null }],
    ['the PDF is missing from disk', { id: 2, local_file_path: path.join(PDF_DIR, 'gone.pdf') }],
  ])('fails with ERR_NOT_FOUND when %s', async (_label, article) => {
    db.getArticle.mockReturnValue(article);

    const payload = await rejectionPayload(invoke(IpcChannel.PDF_GET, 2));

    expect(payload.message).toBe(
      '[ERR_NOT_FOUND] PDF não encontrado. Offending value: articleId=2. Expected shape: ID de artigo com arquivo PDF existente em disco.',
    );
  });
});

describe('PDF_UNLINK', () => {
  const stored = path.join(PDF_DIR, 'shared.pdf');

  beforeEach(() => {
    disk.addFile(stored, CONTENT);
    db.getArticle.mockReturnValue({ id: 2, local_file_path: stored });
  });

  it.each([
    ['the article does not exist', undefined],
    ['the article has no PDF', { id: 2, local_file_path: null }],
  ])('does nothing when %s', async (_label, article) => {
    db.getArticle.mockReturnValue(article);

    expect(await invoke(IpcChannel.PDF_UNLINK, 2)).toBeUndefined();
    expect(db.unlinkPdfFromArticle).not.toHaveBeenCalled();
  });

  it('deletes the file and its record when no other article uses it', async () => {
    db.getArticlesForPdf.mockReturnValue([]);

    await invoke(IpcChannel.PDF_UNLINK, 2);

    expect(db.unlinkPdfFromArticle).toHaveBeenCalledWith(2);
    expect(db.getArticlesForPdf).toHaveBeenCalledWith(stored);
    expect(disk.files.has(stored)).toBe(false);
    expect(db.deletePdfRecord).toHaveBeenCalledWith(stored);
  });

  it('keeps the file while other articles still reference it', async () => {
    db.getArticlesForPdf.mockReturnValue([{ id: 3 }]);

    await invoke(IpcChannel.PDF_UNLINK, 2);

    expect(db.unlinkPdfFromArticle).toHaveBeenCalledWith(2);
    expect(disk.files.has(stored)).toBe(true);
    expect(db.deletePdfRecord).not.toHaveBeenCalled();
  });

  it('skips deletion when the file is already gone', async () => {
    db.getArticlesForPdf.mockReturnValue([]);
    disk.files.delete(stored);

    await invoke(IpcChannel.PDF_UNLINK, 2);

    expect(db.deletePdfRecord).not.toHaveBeenCalled();
  });

  it('logs and keeps the record when the file cannot be deleted', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db.getArticlesForPdf.mockReturnValue([]);
    disk.failNext('unlinkSync', new Error('EBUSY'));

    await invoke(IpcChannel.PDF_UNLINK, 2);

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to delete physical PDF file:',
      expect.objectContaining({ message: 'EBUSY' }),
    );
    expect(db.deletePdfRecord).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('PDF_LIBRARY_DELETE', () => {
  const stored = path.join(PDF_DIR, 'lib.pdf');

  it('removes the record and the file, returning the affected article ids', async () => {
    disk.addFile(stored, CONTENT);
    db.deletePdfLibraryRecord.mockReturnValue([2, 3]);

    expect(await invoke(IpcChannel.PDF_LIBRARY_DELETE, stored)).toEqual([2, 3]);
    expect(db.deletePdfLibraryRecord).toHaveBeenCalledWith(stored);
    expect(disk.files.has(stored)).toBe(false);
  });

  it('still returns the ids when the file is already gone', async () => {
    db.deletePdfLibraryRecord.mockReturnValue([2]);

    expect(await invoke(IpcChannel.PDF_LIBRARY_DELETE, stored)).toEqual([2]);
  });

  it('logs a failed file deletion without failing the request', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    disk.addFile(stored, CONTENT);
    db.deletePdfLibraryRecord.mockReturnValue([4]);
    disk.failNext('unlinkSync', new Error('EPERM'));

    expect(await invoke(IpcChannel.PDF_LIBRARY_DELETE, stored)).toEqual([4]);
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to delete physical PDF file:',
      expect.objectContaining({ message: 'EPERM' }),
    );
    consoleError.mockRestore();
  });
});
