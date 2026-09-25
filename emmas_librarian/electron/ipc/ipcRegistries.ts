import { ipcMain, app } from 'electron';
import path from 'path';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { ScientificVenueRepository } from '../database/ScientificVenueRepository';
import { SyncService } from '../database/SyncService';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { QueryTranslator } from '../services/QueryTranslator';
import { ApiIntegrator } from '../services/ApiIntegrator';
import { ExportService } from '../services/ExportService';
import { AIService } from '../services/AIService';
import { BackupService } from '../services/BackupService';
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

/**
 * Composition root of the main process: opens the database, builds the services and
 * registers every IPC handler exactly once.
 *
 * Usage (electron/main.ts):
 *   app.whenReady().then(() => { setupIpcRegistries(); createWindow(); });
 */
export function setupIpcRegistries(): void {
  const userData = app.getPath('userData');
  const dbPath = path.join(userData, 'emma.db');
  const db = new DatabaseAdapter(dbPath);
  const backupService = new BackupService(db, dbPath, path.join(userData, 'backups'));
  scheduleStartupBackup(backupService);

  const orchestrator = new SearchOrchestrator(db, new QueryTranslator(), new ApiIntegrator());
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
}
