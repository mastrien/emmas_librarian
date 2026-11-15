import type { CommandRegistry } from '../commands/CommandRegistry';
import { usageError } from '../errors/usageError';
import { shellFailureFrom } from '../errors/shellFailureFrom';
import { bindArguments } from './bindArguments';
import type { CommandSchema } from './commandSchema';
import { toToolDefinition, type ToolDefinition } from './toolDefinition';
import { toToolName } from './toolNames';
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
}

interface Exposed {
  schema: CommandSchema;
  tool: ToolDefinition;
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

  constructor(private readonly options: ToolkitOptions) {
    this.clock = options.clock ?? Date.now;
    for (const schema of options.schemas) this.expose(schema);
  }

  private expose(schema: CommandSchema): void {
    if (!this.options.commands.has(schema.name)) return;
    const reason = whyHidden(this.options.commands.get(schema.name), schema);
    if (reason) {
      this.hiddenCommands.push({ name: schema.name, reason });
      return;
    }
    this.exposed.set(toToolName(schema.name), { schema, tool: toToolDefinition(schema) });
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
      const { schema } = this.requireTool(toolName);
      const args = bindArguments(schema, input);
      const result = await this.options.commands.run(schema.name, ...args);
      return { ok: true, result: result ?? null };
    } catch (error) {
      const { code, type, message } = shellFailureFrom(error);
      return { ok: false, error: { code, type, message } };
    }
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
