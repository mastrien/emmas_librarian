import { usageError } from '../errors/usageError';
import { shellFailureFrom } from '../errors/shellFailureFrom';
import type { LibraryToolkit, ToolResult } from './LibraryToolkit';
import type { ToolDefinition } from './toolDefinition';
import { toToolName } from './toolNames';
import type { ToolSurface } from './toolSurface';
import { TOOL_AREAS, type ToolArea } from './toolAreas';

export const SELECT_AREAS = 'select_areas';

/**
 * The library by subject. A model starts with one tool, `select_areas`, and asks for the subjects its request is about;
 * only then does it see the tools of those subjects. Asking again adds subjects, so a request that crosses two of them
 * (read an article, write the diary) works. A tool of an area not chosen yet answers with what to do.
 *
 * Usage:
 *   const routed = new RoutedToolkit(toolkit);
 *   routed.tools();                                    // [select_areas]
 *   await routed.call('select_areas', { areas: ['artigos'] });
 *   routed.tools();                                    // select_areas + the tools of "artigos"
 */
export class RoutedToolkit implements ToolSurface {
  private readonly chosen = new Set<string>();
  private readonly areas: ToolArea[];

  constructor(
    private readonly inner: LibraryToolkit,
    areas: readonly ToolArea[] = TOOL_AREAS,
  ) {
    const offered = new Set(inner.tools().map((tool) => tool.name));
    this.areas = areas
      .map((area) => ({ ...area, commands: area.commands.filter((command) => offered.has(toToolName(command))) }))
      .filter((area) => area.commands.length > 0);
  }

  tools(): ToolDefinition[] {
    const open = new Set(this.areas.filter((a) => this.chosen.has(a.id)).flatMap((a) => a.commands.map(toToolName)));
    return [this.selector(), ...this.inner.tools().filter((tool) => open.has(tool.name))];
  }

  private selector(): ToolDefinition {
    const list = this.areas.map((area) => `- ${area.id}: ${area.about}`).join('\n');
    return {
      name: SELECT_AREAS,
      description: `Escolha os assuntos do pedido para receber as ferramentas deles. Pode chamar de novo para somar assuntos.\n${list}`,
      input_schema: {
        type: 'object',
        properties: { areas: { type: 'array', items: { enum: this.areas.map((area) => area.id) } } },
        required: ['areas'],
        additionalProperties: false,
      },
    };
  }

  async call(toolName: string, input: unknown): Promise<ToolResult> {
    if (toolName === SELECT_AREAS) return this.select(input);
    if (this.tools().some((tool) => tool.name === toolName)) return this.inner.call(toolName, input);
    const area = this.areas.find((a) => a.commands.some((command) => toToolName(command) === toolName));
    // Not run: a tool of an area not chosen yet reads as "unknown tool" to the toolkit, which would send the model
    // hunting for another name; say what to do instead.
    return area ? this.notSelected(toolName, area) : this.inner.call(toolName, input);
  }

  private notSelected(toolName: string, area: ToolArea): ToolResult {
    const problem = `A ferramenta "${toolName}" é do assunto "${area.id}", que ainda não foi escolhido. Offending value: ${JSON.stringify(toolName)}`;
    const error = usageError(
      'ERR_AREA_NOT_SELECTED',
      problem,
      `chamar ${SELECT_AREAS} com { "areas": ["${area.id}"] } antes`,
    );
    const { code, type, message } = shellFailureFrom(error);
    return { ok: false, error: { code, type, message } };
  }

  private select(input: unknown): ToolResult {
    const wanted = (input as { areas?: unknown } | null)?.areas;
    const known = new Set(this.areas.map((area) => area.id));
    const valid =
      Array.isArray(wanted) && wanted.length > 0 && wanted.every((id) => typeof id === 'string' && known.has(id));
    if (!valid) return this.refuse(input, known);
    for (const id of wanted as string[]) this.chosen.add(id);
    const tools = this.tools()
      .filter((tool) => tool.name !== SELECT_AREAS)
      .map((tool) => tool.name);
    return { ok: true, result: { areas: [...this.chosen], tools } };
  }

  private refuse(input: unknown, known: Set<string>): ToolResult {
    const error = usageError(
      'ERR_INVALID_ARGUMENTS',
      `Argumentos inválidos para "${SELECT_AREAS}". Offending value: ${JSON.stringify(input)}`,
      `{ "areas": uma lista com um ou mais de: ${[...known].join(', ')} }`,
    );
    const { code, type, message } = shellFailureFrom(error);
    return { ok: false, error: { code, type, message } };
  }
}
