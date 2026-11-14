import type { Dialog } from 'electron';
import type { FileTypeFilter } from '../../core/commands/CommandRegistry';

export type { FileTypeFilter };

export interface SaveFileRequest {
  title?: string;
  defaultPath?: string;
  filters?: FileTypeFilter[];
}

/** E2E_MOCK_* variables that answer an open dialog; the default is the generic E2E_MOCK_OPEN_FILE. */
export type OpenFileAnswerVariable = 'E2E_MOCK_OPEN_FILE' | 'E2E_MOCK_PROJECT_FILE' | 'E2E_MOCK_BACKUP_FILE';

export interface OpenFileRequest {
  title?: string;
  filters?: FileTypeFilter[];
  /** Which variable names the file in E2E runs, where nobody can click the native dialog. */
  answeredInE2EBy?: OpenFileAnswerVariable;
}

/**
 * Port of the desktop shell for asking the user which file to read or write. The core never asks:
 * its services receive the path, so a CLI passes an argument where the app shows a dialog.
 * Every method answers null (or an empty list) when the user cancels.
 */
export interface FilePicker {
  chooseSavePath(request: SaveFileRequest): Promise<string | null>;
  chooseFile(request: OpenFileRequest): Promise<string | null>;
  chooseFiles(request: OpenFileRequest): Promise<string[]>;
}

export type NativeDialogs = Pick<Dialog, 'showSaveDialog' | 'showOpenDialog'>;

/**
 * FilePicker over Electron's native dialogs. Playwright cannot drive those, so E2E runs name the file
 * in an E2E_MOCK_* variable and no dialog opens.
 *
 * Usage:
 *   const picker = new NativeFilePicker(dialog, process.env);
 *   const target = await picker.chooseSavePath({ title: 'Exportar Projeto', defaultPath: 'projeto_3.emmapcarc' });
 */
export class NativeFilePicker implements FilePicker {
  constructor(
    private dialogs: NativeDialogs,
    private env: Record<string, string | undefined>,
  ) {}

  async chooseSavePath(request: SaveFileRequest): Promise<string | null> {
    if (this.env.E2E_MOCK_SAVE_FILE_PATH) return this.env.E2E_MOCK_SAVE_FILE_PATH;
    const { canceled, filePath } = await this.dialogs.showSaveDialog({ ...request });
    return canceled || !filePath ? null : filePath;
  }

  async chooseFile(request: OpenFileRequest): Promise<string | null> {
    const answered = this.env[request.answeredInE2EBy ?? 'E2E_MOCK_OPEN_FILE'];
    if (answered) return answered;
    const { canceled, filePaths } = await this.dialogs.showOpenDialog({
      title: request.title,
      filters: request.filters,
      properties: ['openFile'],
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  }

  async chooseFiles(request: OpenFileRequest): Promise<string[]> {
    if (this.env.E2E_MOCK_OPEN_MULTIPLE_FILES) return this.env.E2E_MOCK_OPEN_MULTIPLE_FILES.split(';');
    const { canceled, filePaths } = await this.dialogs.showOpenDialog({
      title: request.title,
      filters: request.filters,
      properties: ['openFile', 'multiSelections'],
    });
    return canceled ? [] : filePaths;
  }
}
