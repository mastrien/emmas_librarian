import { ipcMain, app, dialog } from 'electron';
import { DatabaseAdapter } from '../../core/database/DatabaseAdapter';
import { buildLibraryCommands } from '../../core/commands/libraryCommands';
import { appPathsIn, type AppPaths } from '../../core/ports/AppPaths';
import { UpdateSafetyService } from '../services/UpdateSafetyService';
import { UpdateManager } from '../services/UpdateManager';
import { NoopAppUpdater } from '../services/NoopAppUpdater';
import type { IAppUpdater } from '../services/UpdateTypes';
import { SafeStorageSecretStore } from '../ports/SafeStorageSecretStore';
import { NativeFilePicker, type FilePicker } from '../ports/FilePicker';
import { electronAppRuntime } from '../ports/electronAppRuntime';
import { scheduleStartupBackup } from '../startupBackup';
import { exposeCommandsOverIpc } from './exposeCommandsOverIpc';
import { registerWindowHandlers } from './handlers/windowHandlers';
import { registerDialogHandlers } from './handlers/dialogHandlers';
import { registerExternalDocumentHandlers } from './handlers/externalDocumentHandlers';
import { registerUpdateHandlers } from './handlers/updateHandlers';

export interface IpcRegistriesDeps {
  db?: DatabaseAdapter;
  safetyService?: UpdateSafetyService;
  updater?: IAppUpdater;
  updateManager?: UpdateManager;
  restartApp?: () => void;
  picker?: FilePicker;
}

export interface IpcRegistriesResult {
  db: DatabaseAdapter;
  safetyService: UpdateSafetyService;
  updateManager: UpdateManager;
}

/**
 * Composition root of the main process: opens the library, lets the core build its commands and
 * exposes them over IPC, then adds what only the desktop app has (dialogs, window, updater).
 * Every IPC handler is registered exactly once.
 *
 * Usage (electron/main.ts):
 *   app.whenReady().then(() => { const { db, updateManager, safetyService } = setupIpcRegistries({ updater: autoUpdater }); createWindow(); });
 */
export function setupIpcRegistries(deps?: IpcRegistriesDeps): IpcRegistriesResult {
  const paths = appPathsIn(app.getPath('userData'));
  const db = deps?.db || new DatabaseAdapter(paths.dbPath, new SafeStorageSecretStore());
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

function registerLibraryServices(db: DatabaseAdapter, paths: AppPaths, deps?: IpcRegistriesDeps): IpcRegistriesResult {
  const runtime = electronAppRuntime(deps?.restartApp);
  const picker = deps?.picker || new NativeFilePicker(dialog, process.env);
  const { commands, autoBackups } = buildLibraryCommands(db, { paths, runtime, env: process.env });
  scheduleStartupBackup(autoBackups);
  exposeCommandsOverIpc(ipcMain, commands, picker);
  registerWindowHandlers(ipcMain);
  registerDialogHandlers(ipcMain, picker);
  registerExternalDocumentHandlers(ipcMain);
  return { db, ...registerAppUpdate(db, paths, deps) };
}

function registerAppUpdate(db: DatabaseAdapter, paths: AppPaths, deps?: IpcRegistriesDeps) {
  const { userData, dbPath, backupsDir } = paths;
  const safetyService = deps?.safetyService || new UpdateSafetyService(db, dbPath, backupsDir, userData);
  const updater = deps?.updater || new NoopAppUpdater();
  const updateManager = deps?.updateManager || new UpdateManager(updater, safetyService);
  registerUpdateHandlers(ipcMain, updateManager, safetyService, deps?.restartApp);
  return { safetyService, updateManager };
}
