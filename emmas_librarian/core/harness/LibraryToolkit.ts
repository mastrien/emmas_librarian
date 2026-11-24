import type { CommandRegistry } from '../commands/CommandRegistry';
import { listTerminalCommands } from '../commands/terminalCommands';
import { AppError } from '../errors/AppError';
import { usageError } from '../errors/usageError';
import { shellFailureFrom } from '../errors/shellFailureFrom';
import { bindArguments } from './bindArguments';
import type { CommandSchema } from './commandSchema';
import { toToolDefinition, type ToolDefinition } from './toolDefinition';
import { restorePositions, withoutParameters } from './hiddenParameters';
import { toToolName } from './toolNames';
import { TOOL_ACCESS, type Access } from './toolAccess';
import { DENY_ALL, type Confirmer } from './confirmer';
import { whyHidden } from './toolPolicy';
import type { TrajectoryLog } from './trajectory';

/** What a tool call answers: the same document the CLI prints, `{ ok, result }` or `{ ok, error }`. */
export type ToolResult =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: string; type: string; message: string } };

export interface ToolkitOptions {
  commands: CommandRegistry;
  /** What `npm run schemas:generate` wrote. */
  schemas: CommandSchema[];
  /** Records every call, to build training data from episodes. */
  log?: TrajectoryLog;
  /** Replaced in tests. */
  clock?: () => number;
  /** Asked before a call that changes the library runs. Without it, such a call is refused. */
  confirmer?: Confirmer;
  /** Whether the model runs on this machine: only then are the tools that send text to a third party offered. */
  modelIsLocal?: boolean;
  /** What a model may use; the library's own table unless a test brings another. */
  access?: ReadonlyMap<string, Access>;
}

interface Exposed {
  schema: CommandSchema;
  /** With the arguments the model never sees. */
  original: CommandSchema;
  tool: ToolDefinition;
  access: Access;
}

/**
 * The library as a model uses it: a list of typed tools, and a way to call one by name with a JSON
 * object. Calls are checked against the schemas before they reach the library, so a wrong call comes
 * back as an error the model can read, never as a quiet success.
 *
 * Usage:
 *   const toolkit = new LibraryToolkit({ commands, schemas });
 *   toolkit.tools(); // give these to the model
 *   await toolkit.call('diary__save', { projectId: 3, date: '2026-11-14', content: 'Li dois artigos.' });
 */
export class LibraryToolkit {
  private readonly exposed = new Map<string, Exposed>();
  private readonly hiddenCommands: Array<{ name: string; reason: string }> = [];
  private readonly clock: () => number;
  private readonly terminal: ReadonlySet<string>;

  constructor(private readonly options: ToolkitOptions) {
    this.clock = options.clock ?? Date.now;
    this.terminal = new Set(listTerminalCommands(options.commands).map((command) => command.name));
    for (const schema of options.schemas) this.expose(schema);
  }

  private expose(schema: CommandSchema): void {
    if (!this.options.commands.has(schema.name)) return;
    const access = (this.options.access ?? TOOL_ACCESS).get(schema.name);
    const command = this.options.commands.get(schema.name);
    const reason = whyHidden({
      command,
      schema,
      access,
      inTerminal: this.terminal.has(schema.name),
      modelIsLocal: this.options.modelIsLocal ?? false,
    });
    if (reason) {
      this.hiddenCommands.push({ name: schema.name, reason });
      return;
    }
    if (!access) return;
    const visible = withoutParameters(schema, access.hideParameters ?? []);
    this.exposed.set(toToolName(schema.name), {
      schema: visible,
      original: schema,
      tool: toToolDefinition(visible),
      access,
    });
  }

  tools(): ToolDefinition[] {
    return [...this.exposed.values()].map(({ tool }) => tool);
  }

  /** The commands kept from the model, with the reason each is kept. */
  hidden(): Array<{ name: string; reason: string }> {
    return [...this.hiddenCommands];
  }

  async call(toolName: string, input: unknown): Promise<ToolResult> {
    const started = this.clock();
    const result = await this.run(toolName, input);
    this.options.log?.record({
      tool: toolName,
      input,
      ok: result.ok,
      output: result.ok ? result.result : result.error,
      durationMs: this.clock() - started,
    });
    return result;
  }

  private async run(toolName: string, input: unknown): Promise<ToolResult> {
    try {
      const { schema, original, access } = this.requireTool(toolName);
      const args = restorePositions(original, access.hideParameters ?? [], bindArguments(schema, input));
      if (access.confirm) await this.requireApproval(toolName, schema.name, input);
      const result = await this.options.commands.run(original.name, ...args);
      return { ok: true, result: result ?? null };
    } catch (error) {
      const { code, type, message } = shellFailureFrom(error);
      return { ok: false, error: { code, type, message } };
    }
  }

  // Asked after the arguments passed their check, so the person is never shown a call that could not run anyway.
  private async requireApproval(tool: string, command: string, input: unknown): Promise<void> {
    const approved = await (this.options.confirmer ?? DENY_ALL).confirm({ tool, command, input });
    if (approved) return;
    throw new AppError(
      'ERR_NOT_CONFIRMED',
      'USER_ERROR',
      `[ERR_NOT_CONFIRMED] The person did not approve ${tool}. Offending value: ${JSON.stringify(input)}. Expected: ask the person again, and only repeat the call after a yes.`,
    );
  }

  private requireTool(toolName: string): Exposed {
    const found = this.exposed.get(toolName);
    if (found) return found;
    throw usageError(
      'ERR_UNKNOWN_TOOL',
      `Ferramenta desconhecida. Offending value: ${JSON.stringify(toolName)}`,
      `uma das ${this.exposed.size} ferramentas oferecidas (por exemplo "projects__getAll")`,
    );
  }
}
