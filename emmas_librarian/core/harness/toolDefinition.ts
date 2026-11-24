import { argumentKey } from './bindArguments';
import type { CommandSchema } from './commandSchema';
import { toToolName } from './toolNames';
import type { ValueSchema } from './valueSchema';

/** A tool as the Messages API takes it (`tools: [...]`). */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, ValueSchema>;
    required: string[];
    additionalProperties: false;
  };
}

const fallbackDescription = (command: CommandSchema): string =>
  `Comando "${command.name}" da biblioteca do Emma's Librarian.`;

/**
 * The tool a model sees for a command. The description is what a person wrote above the command in the
 * code; where nobody wrote one it only names the command, which is the first thing to improve for training.
 *
 * Usage:
 *   toToolDefinition(diarySave); // { name: 'diary__save', description: '...', input_schema: { ... } }
 */
export function toToolDefinition(command: CommandSchema): ToolDefinition {
  const properties = Object.fromEntries(
    command.parameters.map((parameter) => [argumentKey(parameter), parameter.schema]),
  );
  const required = command.parameters.filter((parameter) => parameter.required).map(argumentKey);
  return {
    name: toToolName(command.name),
    description: command.description ?? fallbackDescription(command),
    input_schema: { type: 'object', properties, required, additionalProperties: false },
  };
}
