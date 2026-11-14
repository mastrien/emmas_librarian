import { IpcChannel } from '../types';
import type { CommandRegistry, FileArgument, RegisteredCommand } from '../../core/commands/CommandRegistry';
import type { FilePicker, OpenFileAnswerVariable } from '../ports/FilePicker';
import { handle, type ChannelHandler, type IpcRegistrar } from './handlers/handle';

// Only a project import may come with the file already named by the renderer (a file dropped on the
// window). Every other file is chosen by the person in a dialog: the renderer cannot name where an
// export is written or which backup replaces the library.
const RENDERER_NAMES_FILE: ReadonlySet<string> = new Set([IpcChannel.SYNC_IMPORT_PROJECT]);

const E2E_ANSWERS: Record<NonNullable<FileArgument['kind']>, OpenFileAnswerVariable> = {
  project: 'E2E_MOCK_PROJECT_FILE',
  backup: 'E2E_MOCK_BACKUP_FILE',
};

/**
 * The desktop transport of the core: every registered command becomes an IPC handler on the channel
 * of the same name. Where a command takes a file, the person chooses it in a native dialog first;
 * a cancelled dialog answers what the command declares (null unless it says otherwise) and runs nothing.
 *
 * Usage:
 *   exposeCommandsOverIpc(ipcMain, commands, new NativeFilePicker(dialog, process.env));
 */
export function exposeCommandsOverIpc(ipc: IpcRegistrar, commands: CommandRegistry, picker: FilePicker): void {
  for (const command of commands.list()) {
    handle(ipc, command.name, command.file ? withChosenFile(command, command.file, picker) : direct(command));
  }
}

const direct =
  (command: RegisteredCommand): ChannelHandler =>
  (_event, ...args) =>
    command.run(...args);

function withChosenFile(command: RegisteredCommand, file: FileArgument, picker: FilePicker): ChannelHandler {
  return async (_event, ...args) => {
    const before = args.slice(0, file.at);
    const named: unknown = RENDERER_NAMES_FILE.has(command.name) ? args[file.at] : undefined;
    const chosen = typeof named === 'string' && named ? named : await askForFile(file, before, picker);
    return chosen ? command.run(...before, chosen as never) : (file.whenNotChosen ?? null);
  };
}

function askForFile(file: FileArgument, before: never[], picker: FilePicker): Promise<string | null> {
  const suggestion = file.describe(...before);
  if (file.mode === 'save') return picker.chooseSavePath(suggestion);
  const answeredInE2EBy = file.kind ? E2E_ANSWERS[file.kind] : undefined;
  return picker.chooseFile({ title: suggestion.title, filters: suggestion.filters, answeredInE2EBy });
}
