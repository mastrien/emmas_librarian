import fs from 'fs';
import { shell } from 'electron';
import { IpcChannel } from '../../types';
import { handle, type IpcRegistrar } from './handle';

/**
 * Opens a project document outside the app: its file in the system's viewer, or its link in the browser.
 * Desktop only: there is nothing to open in a terminal or from a phone.
 *
 * Usage:
 *   registerExternalDocumentHandlers(ipcMain);
 */
export function registerExternalDocumentHandlers(ipc: IpcRegistrar): void {
  handle(ipc, IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, (_e, url?: string, filePath?: string) =>
    openDocument(url, filePath),
  );
}

async function openDocument(url?: string, filePath?: string): Promise<void> {
  const localFile = filePath && fs.existsSync(filePath) ? filePath : undefined;
  const target = localFile ?? url;
  if (!target) return;
  // E2E: note the target instead of launching a browser or another app on the test machine.
  const openLog = process.env.E2E_MOCK_OPEN_EXTERNAL_LOG;
  if (openLog) return fs.appendFileSync(openLog, `${target}\n`);
  await (localFile ? shell.openPath(localFile) : shell.openExternal(target));
}
