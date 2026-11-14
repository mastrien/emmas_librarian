import fs from 'fs';
import { IpcChannel } from '../../types';
import type { FilePicker } from '../../ports/FilePicker';
import { handle, type IpcRegistrar } from './handle';

const PDF_FILTERS = [{ name: 'PDF Files', extensions: ['pdf'] }];

/**
 * Native open/save dialogs the renderer asks for directly. E2E runs answer them through the
 * E2E_MOCK_* variables the FilePicker honours, because Playwright cannot drive native dialogs.
 *
 * Usage:
 *   registerDialogHandlers(ipcMain, new NativeFilePicker(dialog, process.env));
 */
export function registerDialogHandlers(ipc: IpcRegistrar, picker: FilePicker): void {
  handle(ipc, IpcChannel.DIALOG_OPEN_FILE, () => picker.chooseFile({ filters: PDF_FILTERS }));
  handle(ipc, IpcChannel.DIALOG_OPEN_MULTIPLE_FILES, () => picker.chooseFiles({ filters: PDF_FILTERS }));
  handle(ipc, IpcChannel.DIALOG_SAVE_FILE, async (_e, content: string, defaultPath?: string) => {
    const target = await picker.chooseSavePath({ defaultPath: defaultPath || 'export.csv' });
    if (!target) return false;
    fs.writeFileSync(target, content, 'utf8');
    return true;
  });
}
