import type { OpenDialogOptions, OpenDialogReturnValue, SaveDialogOptions, SaveDialogReturnValue } from 'electron';

/**
 * Electron's native open/save dialogs with the user's answer scripted: `chosen` holds the picked
 * paths (empty = cancelled). Keeps the options each dialog was opened with.
 *
 * Usage:
 *   const dialogs = new FakeNativeDialogs();
 *   dialogs.chosen = ['/home/ana/a.pdf'];
 *   await new NativeFilePicker(dialogs, {}).chooseFile({ title: 'Abrir' });
 */
export class FakeNativeDialogs {
  chosen: string[] = [];
  readonly saveDialogs: SaveDialogOptions[] = [];
  readonly openDialogs: OpenDialogOptions[] = [];

  // Electron overloads both methods (with and without a parent window); only the options form is used.
  showSaveDialog = (async (options: SaveDialogOptions): Promise<SaveDialogReturnValue> => {
    this.saveDialogs.push(options);
    return { canceled: this.chosen.length === 0, filePath: this.chosen[0] ?? '' };
  }) as Electron.Dialog['showSaveDialog'];

  showOpenDialog = (async (options: OpenDialogOptions): Promise<OpenDialogReturnValue> => {
    this.openDialogs.push(options);
    return { canceled: this.chosen.length === 0, filePaths: this.chosen };
  }) as Electron.Dialog['showOpenDialog'];
}
