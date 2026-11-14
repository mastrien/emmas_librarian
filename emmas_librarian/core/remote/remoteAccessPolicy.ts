import { IpcChannel } from '../../src/types';
import type { CommandRegistry, RegisteredCommand } from '../commands/CommandRegistry';
import { surfaceOf } from '../commands/channelSurfaces';
import { libraryInUse, replacesLibrary } from '../commands/libraryReplacement';
import { AppError } from '../errors/AppError';

/** Who is calling: a phone paired over the LAN, or the CLI on this same computer. */
export type RemotePrincipal = { kind: 'device'; deviceId: string } | { kind: 'local' };

/**
 * What a paired phone may read (#32). An explicit list: a new channel is not exposed until someone
 * adds it here. Settings (where the API keys are), backups, the trash, searches and AI stay out.
 */
export const DEVICE_READ_CHANNELS: readonly IpcChannel[] = [
  IpcChannel.APP_GET_VERSION,
  IpcChannel.PROJECTS_GET_ALL,
  IpcChannel.PROJECTS_GET_ONE,
  IpcChannel.PROJECTS_GET_ABOUT,
  IpcChannel.PROJECTS_GET_NAV_COUNTS,
  IpcChannel.PROJECTS_GET_SCREENING_SUMMARIES,
  IpcChannel.PROJECTS_GET_WRITING_PAD,
  IpcChannel.PROJECTS_GET_SEARCH_HISTORY,
  IpcChannel.ARTICLES_GET_BY_PROJECT,
  IpcChannel.ARTICLES_GET_ONE,
  IpcChannel.PDF_GET,
  IpcChannel.HIGHLIGHTS_GET,
  IpcChannel.ANNOTATIONS_GET,
  IpcChannel.DIARY_GET_ALL,
  IpcChannel.DIARY_GET_ONE,
  IpcChannel.DIARY_GET_HISTORY,
  IpcChannel.PROJECT_DOCUMENTS_GET,
  IpcChannel.CATEGORIES_GET_PROJECT,
  IpcChannel.CATEGORIES_GET_ARTICLE,
  IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE,
  IpcChannel.MASSIVE_INVESTIGATIONS_GET,
  IpcChannel.INVESTIGATION_RESULTS_GET,
  IpcChannel.INVESTIGATION_RESULTS_GET_BY_ARTICLE,
  IpcChannel.INVESTIGATION_AUDIT_GET,
  IpcChannel.INVESTIGATION_AUDITS_BY_PROJECT,
  IpcChannel.QUESTION_SETS_LIST,
  IpcChannel.QUESTION_SETS_GET,
  IpcChannel.SCREENING_LABELS_LIST,
  IpcChannel.SCREENING_DECISIONS_LIST,
  IpcChannel.PRISMA_RECORDS_GET,
  IpcChannel.SCIENTIFIC_VENUES_GET_ALL,
];

/** The few writes a phone may make: the diary, quick access links and the categories of an article. */
export const DEVICE_WRITE_CHANNELS: readonly IpcChannel[] = [
  IpcChannel.DIARY_SAVE,
  IpcChannel.PROJECT_DOCUMENTS_CREATE,
  IpcChannel.PROJECT_DOCUMENTS_MARK_OPENED,
  IpcChannel.CATEGORIES_SET_ARTICLE,
];

const DEVICE_CHANNELS: ReadonlySet<string> = new Set([...DEVICE_READ_CHANNELS, ...DEVICE_WRITE_CHANNELS]);

// A quick access document may carry a file copied from a path on the desktop. A phone must never name a
// path of this computer, so its documents are links: the file argument (4th) is always dropped.
const withoutDesktopFile = (args: unknown[]): unknown[] => [args[0], args[1], args[2], null, args[4]];

const DEVICE_ARGUMENT_RULES: Partial<Record<IpcChannel, (args: unknown[]) => unknown[]>> = {
  [IpcChannel.PROJECT_DOCUMENTS_CREATE]: withoutDesktopFile,
};

const isChannel = (name: string): name is IpcChannel => (Object.values(IpcChannel) as string[]).includes(name);

function forbidden(name: string, reason: string): AppError {
  return new AppError(
    'ERR_REMOTE_FORBIDDEN',
    'VALIDATION_ERROR',
    `[ERR_REMOTE_FORBIDDEN] ${reason}. Offending value: "${name}". Expected shape: um comando permitido para este acesso.`,
  );
}

function deviceCommand(command: RegisteredCommand): RegisteredCommand {
  // Never reachable today (no listed channel takes a file), but a file argument is a path on the desktop.
  if (!DEVICE_CHANNELS.has(command.name) || command.file) {
    throw forbidden(command.name, 'Comando não disponível para dispositivos pareados');
  }
  return command;
}

function localCommand(command: RegisteredCommand): RegisteredCommand {
  if (isChannel(command.name) && surfaceOf(command.name) === 'gui-only') {
    throw forbidden(command.name, 'Comando disponível só no aplicativo');
  }
  // Served by the app itself, which has the database open.
  if (replacesLibrary(command.name)) throw libraryInUse(command.name);
  return command;
}

/**
 * The command a caller may run and the arguments it runs with, or an AppError saying why not.
 * Unknown names fail the same way for everyone (ERR_UNKNOWN_COMMAND).
 *
 * Usage:
 *   const { command, args } = authorizeRemoteCommand(commands, { kind: 'device', deviceId }, 'diary:save', body.args);
 *   return command.run(...(args as never[]));
 */
export function authorizeRemoteCommand(
  commands: CommandRegistry,
  principal: RemotePrincipal,
  name: string,
  args: unknown[],
): { command: RegisteredCommand; args: unknown[] } {
  const command = commands.get(name);
  if (principal.kind === 'local') return { command: localCommand(command), args };
  const rule = isChannel(name) ? DEVICE_ARGUMENT_RULES[name] : undefined;
  return { command: deviceCommand(command), args: rule ? rule(args) : args };
}
