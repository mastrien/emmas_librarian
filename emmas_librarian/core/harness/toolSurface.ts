import type { ToolResult } from './LibraryToolkit';
import type { ToolDefinition } from './toolDefinition';

/** What a model is given: the tools it may call now, and a way to call one. The tools may change between calls. */
export interface ToolSurface {
  tools(): ToolDefinition[];
  call(toolName: string, input: unknown): Promise<ToolResult>;
}
