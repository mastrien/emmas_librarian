import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { setupIpcRegistries } from '../ipcRegistries';
import { IpcChannel } from '../../types';
import { harness, resetIpcHarness, invoke, rejectionPayload, flushStartupTasks, DOCS_DIR } from './fakes/ipcHarness';

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

const { db, disk, dialog, exporter } = harness;
const E2E_PATH = path.join(path.sep, 'e2e', 'out.file');

beforeEach(() => {
  resetIpcHarness();
  setupIpcRegistries();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const silenceConsoleError = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);
const notFound = (id: number) =>
  `[ERR_NOT_FOUND] Projeto não encontrado. Offending value: projectId=${id}. Expected shape: ID numérico de projeto cadastrado.`;

describe.each([
  {
    channel: IpcChannel.EXPORT_CSV,
    method: 'exportToCsv',
    content: 'a,b',
    title: 'Export Articles CSV',
    ext: 'csv',
    filter: 'CSV Files',
  },
  {
    channel: IpcChannel.EXPORT_XLSX,
    method: 'exportToXlsx',
    content: Buffer.from('xlsx'),
    title: 'Export Articles XLSX',
    ext: 'xlsx',
    filter: 'Excel Files',
  },
])('$channel', ({ channel, method, content, title, ext, filter }) => {
  beforeEach(() => {
    db.getProject.mockReturnValue({ id: 1, name: 'Tese' });
    db.getArticlesByProject.mockReturnValue([{ id: 2 }]);
    db.getProjectCategories.mockReturnValue([{ id: 3 }]);
    db.getAllProjectArticleCategories.mockReturnValue([{ id: 4 }]);
    exporter[method].mockReturnValue(content);
  });

  it('writes the export where the user chose, including categories', async () => {
    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(path.sep, 'out', `x.${ext}`) });

    expect(await invoke(channel, 1)).toBe(path.join(path.sep, 'out', `x.${ext}`));
    expect(exporter[method]).toHaveBeenCalledWith([{ id: 2 }], [{ id: 3 }], [{ id: 4 }]);
    expect(dialog.showSaveDialog).toHaveBeenCalledWith({
      title,
      defaultPath: `project_1_export.${ext}`,
      filters: [{ name: filter, extensions: [ext] }],
    });
    expect(disk.files.get(path.join(path.sep, 'out', `x.${ext}`))?.toString()).toBe(content.toString());
  });

  it('returns null and writes nothing when the dialog is cancelled', async () => {
    dialog.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });

    expect(await invoke(channel, 1)).toBeNull();
    expect(disk.files.size).toBe(0);
  });

  it('writes to the E2E path without opening a dialog', async () => {
    vi.stubEnv('E2E_MOCK_SAVE_FILE_PATH', E2E_PATH);

    expect(await invoke(channel, 1)).toBe(E2E_PATH);
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(disk.files.get(E2E_PATH)?.toString()).toBe(content.toString());
  });

  it('fails for an unknown project', async () => {
    db.getProject.mockReturnValue(undefined);

    expect((await rejectionPayload(invoke(channel, 404))).message).toBe(notFound(404));
  });
});

describe('EXPORT_BIBLIOSHINY', () => {
  beforeEach(() => {
    db.getProject.mockReturnValue({ id: 1, name: 'Tese' });
    db.getArticlesByProject.mockReturnValue([{ id: 2 }]);
    exporter.exportToBiblioshiny.mockReturnValue('scopus,csv');
  });

  it('suggests a file named after the project and writes it', async () => {
    const target = path.join(path.sep, 'out', 'b.csv');
    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: target });

    expect(await invoke(IpcChannel.EXPORT_BIBLIOSHINY, 1)).toBe(target);
    expect(exporter.exportToBiblioshiny).toHaveBeenCalledWith([{ id: 2 }]);
    expect(dialog.showSaveDialog).toHaveBeenCalledWith({
      title: 'Exportar para Biblioshiny',
      defaultPath: 'Tese_biblioshiny.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });
    expect(disk.files.get(target)?.toString()).toBe('scopus,csv');
  });

  it('returns null when cancelled', async () => {
    dialog.showSaveDialog.mockResolvedValue({ canceled: true });

    expect(await invoke(IpcChannel.EXPORT_BIBLIOSHINY, 1)).toBeNull();
  });

  it('fails for an unknown project', async () => {
    db.getProject.mockReturnValue(null);

    expect((await rejectionPayload(invoke(IpcChannel.EXPORT_BIBLIOSHINY, 9))).message).toBe(notFound(9));
  });
});

describe('file dialogs', () => {
  const pdfFilter = [{ name: 'PDF Files', extensions: ['pdf'] }];

  it('DIALOG_OPEN_FILE returns the first selected PDF', async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/a.pdf', '/b.pdf'] });

    expect(await invoke(IpcChannel.DIALOG_OPEN_FILE)).toBe('/a.pdf');
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openFile'], filters: pdfFilter });
  });

  it.each([
    ['cancelled', { canceled: true, filePaths: ['/a.pdf'] }],
    ['empty', { canceled: false, filePaths: [] }],
  ])('DIALOG_OPEN_FILE returns null when %s', async (_label, result) => {
    dialog.showOpenDialog.mockResolvedValue(result);

    expect(await invoke(IpcChannel.DIALOG_OPEN_FILE)).toBeNull();
  });

  it('DIALOG_OPEN_FILE uses the E2E path when set', async () => {
    vi.stubEnv('E2E_MOCK_OPEN_FILE', '/e2e.pdf');

    expect(await invoke(IpcChannel.DIALOG_OPEN_FILE)).toBe('/e2e.pdf');
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });

  it('DIALOG_OPEN_MULTIPLE_FILES returns every selected PDF', async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/a.pdf', '/b.pdf'] });

    expect(await invoke(IpcChannel.DIALOG_OPEN_MULTIPLE_FILES)).toEqual(['/a.pdf', '/b.pdf']);
    expect(dialog.showOpenDialog).toHaveBeenCalledWith({
      properties: ['openFile', 'multiSelections'],
      filters: pdfFilter,
    });
  });

  it.each([
    ['cancelled', { canceled: true, filePaths: ['/a.pdf'] }],
    ['empty', { canceled: false, filePaths: [] }],
  ])('DIALOG_OPEN_MULTIPLE_FILES returns [] when %s', async (_label, result) => {
    dialog.showOpenDialog.mockResolvedValue(result);

    expect(await invoke(IpcChannel.DIALOG_OPEN_MULTIPLE_FILES)).toEqual([]);
  });

  it('DIALOG_OPEN_MULTIPLE_FILES splits the E2E list on semicolons', async () => {
    vi.stubEnv('E2E_MOCK_OPEN_MULTIPLE_FILES', '/a.pdf;/b.pdf');

    expect(await invoke(IpcChannel.DIALOG_OPEN_MULTIPLE_FILES)).toEqual(['/a.pdf', '/b.pdf']);
  });

  it('DIALOG_SAVE_FILE writes the content to the chosen path', async () => {
    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/out.csv' });

    expect(await invoke(IpcChannel.DIALOG_SAVE_FILE, 'x;y', 'report.csv')).toBe(true);
    expect(dialog.showSaveDialog).toHaveBeenCalledWith({ defaultPath: 'report.csv' });
    expect(disk.files.get('/out.csv')?.toString()).toBe('x;y');
  });

  it('DIALOG_SAVE_FILE defaults the suggested name and reports cancellation', async () => {
    dialog.showSaveDialog.mockResolvedValue({ canceled: true });

    expect(await invoke(IpcChannel.DIALOG_SAVE_FILE, 'x', undefined)).toBe(false);
    expect(dialog.showSaveDialog).toHaveBeenCalledWith({ defaultPath: 'export.csv' });
  });

  it('DIALOG_SAVE_FILE writes to the E2E path when set', async () => {
    vi.stubEnv('E2E_MOCK_SAVE_FILE_PATH', E2E_PATH);

    expect(await invoke(IpcChannel.DIALOG_SAVE_FILE, 'x', 'r.csv')).toBe(true);
    expect(disk.files.get(E2E_PATH)?.toString()).toBe('x');
  });
});

describe('PROJECT_DOCUMENTS_CREATE', () => {
  const source = path.join(path.sep, 'in', 'ata.pdf');

  beforeEach(() => db.saveProjectDocument.mockReturnValue(6));

  it('copies an attached file into project storage', async () => {
    disk.addFile(source, 'doc');

    expect(await invoke(IpcChannel.PROJECT_DOCUMENTS_CREATE, 1, 'Ata', 'http://u', source, 'Reuniões')).toBe(6);
    const stored = db.saveProjectDocument.mock.calls[0][3];
    expect(path.dirname(stored)).toBe(DOCS_DIR);
    expect(path.basename(stored)).toMatch(/^doc_1_\d+\.pdf$/);
    expect(disk.files.get(stored)?.toString()).toBe('doc');
    expect(db.saveProjectDocument).toHaveBeenCalledWith(1, 'Ata', 'http://u', stored, 'Reuniões');
  });

  it('stores nulls for omitted optionals', async () => {
    await invoke(IpcChannel.PROJECT_DOCUMENTS_CREATE, 1, 'Link');

    expect(db.saveProjectDocument).toHaveBeenCalledWith(1, 'Link', null, null, null);
  });

  it('does not record a file path when the copy fails', async () => {
    const consoleError = silenceConsoleError();

    await invoke(IpcChannel.PROJECT_DOCUMENTS_CREATE, 1, 'Ata', null, path.join(path.sep, 'missing.pdf'), null);

    expect(db.saveProjectDocument).toHaveBeenCalledWith(1, 'Ata', null, null, null);
    expect(consoleError).toHaveBeenCalledWith('Failed to copy PDF file for project document:', expect.any(Error));
  });
});

describe('PROJECT_DOCUMENTS_UPDATE', () => {
  const external = path.join(path.sep, 'in', 'nova.pdf');

  it('copies a newly attached external file into project storage', async () => {
    disk.addFile(external, 'v2');

    await invoke(IpcChannel.PROJECT_DOCUMENTS_UPDATE, 4, 'Ata', null, external, 'Geral');

    const stored = db.updateProjectDocument.mock.calls[0][3];
    expect(path.dirname(stored)).toBe(DOCS_DIR);
    expect(path.basename(stored)).toMatch(/^doc_\d+\.pdf$/);
    expect(disk.files.get(stored)?.toString()).toBe('v2');
    expect(db.updateProjectDocument).toHaveBeenCalledWith(4, 'Ata', null, stored, 'Geral');
  });

  it('keeps a file that is already in project storage without copying', async () => {
    const stored = path.join(DOCS_DIR, 'doc_1.pdf');

    await invoke(IpcChannel.PROJECT_DOCUMENTS_UPDATE, 4, 'Ata', 'http://u', stored, 'Geral');

    expect(db.updateProjectDocument).toHaveBeenCalledWith(4, 'Ata', 'http://u', stored, 'Geral');
    expect(disk.files.size).toBe(0);
  });

  it('stores nulls when there is no file, url or category', async () => {
    await invoke(IpcChannel.PROJECT_DOCUMENTS_UPDATE, 4, 'Ata');

    expect(db.updateProjectDocument).toHaveBeenCalledWith(4, 'Ata', null, null, null);
  });

  it('keeps the original file path when the copy fails', async () => {
    const consoleError = silenceConsoleError();

    await invoke(IpcChannel.PROJECT_DOCUMENTS_UPDATE, 4, 'Ata', null, external, null);

    expect(db.updateProjectDocument).toHaveBeenCalledWith(4, 'Ata', null, external, null);
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to copy PDF file for updating project document:',
      expect.any(Error),
    );
  });
});

describe('PROJECT_DOCUMENT_OPEN_EXTERNAL', () => {
  const file = path.join(DOCS_DIR, 'doc.pdf');

  it('opens a local file that exists, ignoring the url', async () => {
    disk.addFile(file, 'x');

    await invoke(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, 'http://u', file);

    expect(harness.shell.openPath).toHaveBeenCalledWith(file);
    expect(harness.shell.openExternal).not.toHaveBeenCalled();
  });

  it('falls back to the url when the file is missing', async () => {
    await invoke(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, 'http://u', file);

    expect(harness.shell.openExternal).toHaveBeenCalledWith('http://u');
    expect(harness.shell.openPath).not.toHaveBeenCalled();
  });

  it('does nothing without a usable target', async () => {
    await invoke(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, undefined, file);

    expect(harness.shell.openExternal).not.toHaveBeenCalled();
    expect(harness.shell.openPath).not.toHaveBeenCalled();
  });
});

describe('UPDATE_TITLE_BAR', () => {
  const window = { setTitleBarOverlay: vi.fn() };

  beforeEach(() => {
    window.setTitleBarOverlay.mockReset();
    harness.windows.fromWebContents.mockReturnValue(window);
  });

  it.each([
    ['dark', { color: '#0f172a', symbolColor: '#e2e8f0' }],
    ['light', { color: '#f8fafc', symbolColor: '#334155' }],
  ])('applies the %s palette to the sender window', async (theme, overlay) => {
    await invoke('UPDATE_TITLE_BAR', theme);

    expect(harness.windows.fromWebContents).toHaveBeenCalledWith(harness.ipcMain.sender);
    expect(window.setTitleBarOverlay).toHaveBeenCalledWith(overlay);
  });

  it('ignores senders without a window', async () => {
    harness.windows.fromWebContents.mockReturnValue(null);

    await expect(invoke('UPDATE_TITLE_BAR', 'dark')).resolves.toBeUndefined();
  });
});

describe('startup auto backup', () => {
  async function startWith(configure: () => void): Promise<void> {
    resetIpcHarness();
    configure();
    setupIpcRegistries();
    await flushStartupTasks();
  }

  it('logs the created backup and rotates old ones', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await startWith(() => harness.backup.runAutoBackup.mockResolvedValue('/b/auto.zip'));

    expect(consoleLog).toHaveBeenCalledWith('Auto backup created successfully at: /b/auto.zip');
    expect(harness.backup.rotateBackups).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when no backup was needed', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await startWith(() => harness.backup.runAutoBackup.mockResolvedValue(null));

    expect(consoleLog).not.toHaveBeenCalled();
    expect(harness.backup.rotateBackups).toHaveBeenCalledTimes(1);
  });

  it('still rotates when the backup fails', async () => {
    const consoleError = silenceConsoleError();

    await startWith(() => harness.backup.runAutoBackup.mockRejectedValue(new Error('disk full')));

    expect(consoleError).toHaveBeenCalledWith('Auto backup failed:', expect.objectContaining({ message: 'disk full' }));
    expect(harness.backup.rotateBackups).toHaveBeenCalledTimes(1);
  });

  it('logs a failed rotation', async () => {
    const consoleError = silenceConsoleError();

    await startWith(() =>
      harness.backup.rotateBackups.mockImplementation(() => {
        throw new Error('EPERM');
      }),
    );

    expect(consoleError).toHaveBeenCalledWith('Backup rotation failed:', expect.objectContaining({ message: 'EPERM' }));
  });
});
