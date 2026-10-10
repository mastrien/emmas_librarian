import { app, BrowserWindow } from 'electron';
import { IpcChannel } from '../../../src/types';
import type { UpdateManager } from '../../services/UpdateManager';
import type { UpdateSafetyService } from '../../services/UpdateSafetyService';
import { handle, type IpcRegistrar } from './handle';
import { restartApp } from '../../restartApp';

/**
 * Broadcasts update lifecycle events to every active BrowserWindow.
 */
function broadcastToWindows(channel: string, payload: unknown): void {
  const windows = typeof BrowserWindow?.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
  if (!Array.isArray(windows)) return;
  windows.forEach((win) => {
    if (win && !win.isDestroyed?.()) {
      win.webContents?.send?.(channel, payload);
    }
  });
}

/**
 * Registers IPC handlers and notification forwarders for application updates.
 *
 * Usage:
 *   registerUpdateHandlers(ipcMain, updateManager, safetyService);
 */
export function registerUpdateHandlers(
  ipc: IpcRegistrar,
  updateManager: UpdateManager,
  safetyService: UpdateSafetyService,
  restart: () => void = restartApp,
): void {
  handle(ipc, IpcChannel.UPDATE_GET_STATUS, () => updateManager.getStatus());
  handle(ipc, IpcChannel.UPDATE_CHECK, () => updateManager.checkForUpdates());
  handle(ipc, IpcChannel.UPDATE_DOWNLOAD, () => updateManager.downloadUpdate());
  handle(ipc, IpcChannel.UPDATE_INSTALL, () => updateManager.prepareAndInstall(app.getVersion()));
  // No path from the renderer: only the snapshot recorded in update_state.json can replace the library.
  // The connection is closed by the restore, so the app restarts to reopen the restored file.
  handle(ipc, IpcChannel.UPDATE_RESTORE_SNAPSHOT, () => {
    const result = safetyService.restorePreUpdateSnapshot();
    restart();
    return result;
  });

  updateManager.addStatusListener((status) => {
    broadcastToWindows('update:status-changed', status);
  });

  updateManager.addProgressListener((progress) => {
    broadcastToWindows('update:download-progress', progress);
  });
}
