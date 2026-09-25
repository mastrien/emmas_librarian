import fs from 'fs';
import { dialog } from 'electron';
import { IpcChannel } from '../../types';
import { handle, type IpcRegistrar } from './handle';

const PDF_FILTERS = [{ name: 'PDF Files', extensions: ['pdf'] }];

/**
 * Native open/save dialogs. Each honours an E2E_MOCK_* variable because Playwright cannot drive native dialogs.
 *
 * Usage:
 *   registerDialogHandlers(ipcMain);
 */
export function registerDialogHandlers(ipc: IpcRegistrar): void {
  handle(ipc, IpcChannel.DIALOG_OPEN_FILE, async () => {
    if (process.env.E2E_MOCK_OPEN_FILE) return process.env.E2E_MOCK_OPEN_FILE;
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: PDF_FILTERS });
    return !canceled && filePaths.length > 0 ? filePaths[0] : null;
  });
  handle(ipc, IpcChannel.DIALOG_OPEN_MULTIPLE_FILES, async () => {
    if (process.env.E2E_MOCK_OPEN_MULTIPLE_FILES) return process.env.E2E_MOCK_OPEN_MULTIPLE_FILES.split(';');
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: PDF_FILTERS,
    });
    return !canceled && filePaths.length > 0 ? filePaths : [];
  });
  handle(ipc, IpcChannel.DIALOG_SAVE_FILE, (_e, content: string, defaultPath?: string) =>
    saveTextFile(content, defaultPath),
  );
}

async function saveTextFile(content: string, defaultPath?: string): Promise<boolean> {
  const target = process.env.E2E_MOCK_SAVE_FILE_PATH || (await chooseSavePath(defaultPath));
  if (!target) return false;
  fs.writeFileSync(target, content, 'utf8');
  return true;
}

async function chooseSavePath(defaultPath?: string): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: defaultPath || 'export.csv' });
  return !canceled && filePath ? filePath : null;
}
