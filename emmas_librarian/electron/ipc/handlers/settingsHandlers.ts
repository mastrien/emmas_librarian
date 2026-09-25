import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';

/**
 * Key/value application settings (API keys, RAG parameters, UI preferences).
 *
 * Usage:
 *   registerSettingsHandlers(ipcMain, db);
 */
export function registerSettingsHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.SETTINGS_GET, (_e, key: string) => db.getSetting(key));
  handle(ipc, IpcChannel.SETTINGS_SET, (_e, key: string, value: string) => db.setSetting(key, value));
}
