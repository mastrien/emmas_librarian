import { IpcChannel } from '../../src/types';
import { AppError } from '../errors/AppError';

// These swap the database file under whoever has it open.
const REPLACING: ReadonlySet<string> = new Set([IpcChannel.BACKUP_RESTORE_OVERRIDE, IpcChannel.BACKUP_RESTORE_AUTO]);

/**
 * Whether a command replaces the library's database file, which must not happen from outside the
 * desktop app while the app has it open.
 *
 * Usage:
 *   if (replacesLibrary(name) && appIsOpen) throw libraryInUse(name);
 */
export function replacesLibrary(name: string): boolean {
  return REPLACING.has(name);
}

/**
 * The refusal for a command that would replace a library in use.
 *
 * Usage:
 *   throw libraryInUse(IpcChannel.BACKUP_RESTORE_AUTO);
 */
export function libraryInUse(name: string): AppError {
  return new AppError(
    'ERR_LIBRARY_IN_USE',
    'USER_ERROR',
    `[ERR_LIBRARY_IN_USE] O aplicativo está aberto nesta biblioteca e "${name}" substituiria o banco de dados em uso. Expected shape: feche o Emma's Librarian e rode o comando de novo.`,
  );
}
