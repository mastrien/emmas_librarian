import { AppError } from '../errors/AppError';

// `never[]` accepts functions with any concrete parameter list; arguments are untyped at every transport's edge.
export type CommandFn = (...args: never[]) => unknown;

export interface FileTypeFilter {
  name: string;
  extensions: string[];
}

/** What a shell needs to ask a person for a file: a dialog in the app, the help text of a CLI flag. */
export interface FileSuggestion {
  title: string;
  /** Suggested name when the file is written. */
  defaultPath?: string;
  filters: FileTypeFilter[];
}

/**
 * One argument of a command is the path of a file the command reads or writes. The core never asks
 * for it: the shell fills that position (dialog, CLI argument, upload) before running the command.
 */
export interface FileArgument {
  /** Position of the path among the command's arguments. */
  at: number;
  mode: 'open' | 'save';
  /** Which kind of library file it is, for shells that treat kinds differently (E2E answers, upload types). */
  kind?: 'project' | 'backup';
  /** Describes the file from the other arguments; may reject them (unknown project) before anyone is asked. */
  describe: (...args: never[]) => FileSuggestion;
  /** What a shell answers when the person gives no file. Null unless the command's callers expect otherwise. */
  whenNotChosen?: unknown;
}

export interface CommandOptions {
  file?: FileArgument;
}

export interface RegisteredCommand {
  name: string;
  run: CommandFn;
  file?: FileArgument;
}

/**
 * Every operation of the library by name, free of any transport: the desktop app exposes these over
 * IPC, the CLI as subcommands and the LAN server over HTTP (epic #27). Names are the IpcChannel values.
 *
 * Usage:
 *   const commands = new CommandRegistry();
 *   commands.add(IpcChannel.PROJECTS_GET_ONE, (id: number) => db.getProject(id));
 *   const project = await commands.run(IpcChannel.PROJECTS_GET_ONE, 3);
 */
export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();

  /** Registers a command; a second one under the same name is a wiring mistake and is refused. */
  add(name: string, run: CommandFn, options: CommandOptions = {}): void {
    if (this.commands.has(name)) {
      throw new Error(`Command "${name}" is already registered; expected each command name to be added once`);
    }
    this.commands.set(name, { name, run, file: options.file });
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  names(): string[] {
    return [...this.commands.keys()];
  }

  list(): RegisteredCommand[] {
    return [...this.commands.values()];
  }

  /** The registered command, or an ERR_UNKNOWN_COMMAND AppError naming what was asked for. */
  get(name: string): RegisteredCommand {
    const command = this.commands.get(name);
    if (command) return command;
    throw new AppError(
      'ERR_UNKNOWN_COMMAND',
      'VALIDATION_ERROR',
      `[ERR_UNKNOWN_COMMAND] Comando desconhecido. Offending value: "${name}". Expected shape: um dos ${this.commands.size} comandos registrados (por exemplo "projects:getAll").`,
    );
  }

  /** Runs a command with the arguments as a transport received them. */
  async run(name: string, ...args: unknown[]): Promise<unknown> {
    return this.get(name).run(...(args as never[]));
  }
}
