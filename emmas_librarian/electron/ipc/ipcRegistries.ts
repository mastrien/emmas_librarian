import { ipcMain, app } from 'electron';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { ScientificVenueRepository } from '../database/ScientificVenueRepository';
import { SyncService } from '../database/SyncService';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { QueryTranslator } from '../services/QueryTranslator';
import { apiIntegratorFor } from '../services/E2eMockApiIntegrator';
import { ExportService } from '../services/ExportService';
import { AIService } from '../services/AIService';
import { BackupService } from '../services/BackupService';
import { UpdateSafetyService } from '../services/UpdateSafetyService';
import { UpdateManager } from '../services/UpdateManager';
import { NoopAppUpdater } from '../services/NoopAppUpdater';
import type { IAppUpdater } from '../services/UpdateTypes';
import { setupAiIpcHandlers } from './aiIpcHandlers';
import { registerWindowHandlers } from './handlers/windowHandlers';
import { registerProjectHandlers, registerSearchHandlers } from './handlers/projectHandlers';
import { registerArticleHandlers } from './handlers/articleHandlers';
import { registerAnnotationHandlers } from './handlers/annotationHandlers';
import { registerPdfHandlers } from './handlers/pdfHandlers';
import { registerExportHandlers } from './handlers/exportHandlers';
import { registerDialogHandlers } from './handlers/dialogHandlers';
import { registerDocumentHandlers } from './handlers/documentHandlers';
import { registerDiaryAndTrashHandlers } from './handlers/diaryHandlers';
import { registerCategoryAndInvestigationHandlers } from './handlers/categoryHandlers';
import { registerBackupHandlers, scheduleStartupBackup } from './handlers/backupHandlers';
import { registerAgendaHandlers } from './handlers/agendaHandlers';
import { registerSettingsHandlers } from './handlers/settingsHandlers';
import { registerUpdateHandlers } from './handlers/updateHandlers';
import { libraryPaths, type LibraryPaths } from '../startupRecovery';

export interface IpcRegistriesDeps {
  db?: DatabaseAdapter;
  safetyService?: UpdateSafetyService;
  updater?: IAppUpdater;
  updateManager?: UpdateManager;
  restartApp?: () => void;
}

export interface IpcRegistriesResult {
  db: DatabaseAdapter;
  safetyService: UpdateSafetyService;
  updateManager: UpdateManager;
}

/**
 * Composition root of the main process: opens the database, builds the services and
 * registers every IPC handler exactly once.
 *
 * Usage (electron/main.ts):
 *   app.whenReady().then(() => { const { db, updateManager, safetyService } = setupIpcRegistries({ updater: autoUpdater }); createWindow(); });
 */
export function setupIpcRegistries(deps?: IpcRegistriesDeps): IpcRegistriesResult {
  const paths = libraryPaths(app.getPath('userData'));
  const db = deps?.db || new DatabaseAdapter(paths.dbPath);
  try {
    return registerLibraryServices(db, paths, deps);
  } catch (err) {
    // An open library file stays locked on Windows, which would make the startup recovery's restore fail.
    if (!deps?.db) closeQuietly(db);
    throw err;
  }
}

function closeQuietly(db: DatabaseAdapter): void {
  try {
    db.close();
  } catch (err) {
    console.error('Could not close the library after a failed startup:', err);
  }
}

function registerLibraryServices(
  db: DatabaseAdapter,
  { userData, dbPath, backupsDir }: LibraryPaths,
  deps?: IpcRegistriesDeps,
): IpcRegistriesResult {
  const backupService = new BackupService(db, dbPath, backupsDir);
  scheduleStartupBackup(backupService);

  const safetyService = deps?.safetyService || new UpdateSafetyService(db, dbPath, backupsDir, userData);
  const updater = deps?.updater || new NoopAppUpdater();
  const updateManager = deps?.updateManager || new UpdateManager(updater, safetyService);

  // E2E runs must not hit the real bibliographic APIs.
  const orchestrator = new SearchOrchestrator(db, new QueryTranslator(), apiIntegratorFor(process.env));
  setupAiIpcHandlers(db, new AIService(db));

  registerWindowHandlers(ipcMain);
  registerProjectHandlers(ipcMain, db);
  registerSearchHandlers(ipcMain, db, orchestrator);
  registerSettingsHandlers(ipcMain, db);
  registerArticleHandlers(ipcMain, db);
  registerAnnotationHandlers(ipcMain, db);
  registerPdfHandlers(ipcMain, db);
  registerExportHandlers(ipcMain, db, new ExportService());
  registerDialogHandlers(ipcMain);
  registerDocumentHandlers(ipcMain, db);
  registerDiaryAndTrashHandlers(ipcMain, db);
  registerCategoryAndInvestigationHandlers(ipcMain, db);
  registerBackupHandlers(ipcMain, new SyncService(db), backupService);
  registerAgendaHandlers(ipcMain, new ScientificVenueRepository(db.getDB()));
  registerUpdateHandlers(ipcMain, updateManager, safetyService, deps?.restartApp);

  return { db, safetyService, updateManager };
}
