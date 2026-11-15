import type { CommandSchema } from './commandSchema';

/**
 * The command as a model sees it, without the arguments it must never choose (a path on the disk, say).
 *
 * Usage:
 *   withoutParameters(documentsCreate, ['sourceFilePath']); // the same command, one argument fewer
 */
export function withoutParameters(schema: CommandSchema, names: readonly string[]): CommandSchema {
  return { ...schema, parameters: schema.parameters.filter((parameter) => !names.includes(parameter.name)) };
}

/**
 * Puts the arguments a model gave back in the positions the command takes them, leaving the hidden ones empty.
 *
 * Usage:
 *   restorePositions(documentsCreate, ['sourceFilePath'], [3, 'Guia', 'https://x.org', 'tema']);
 *   // [3, 'Guia', 'https://x.org', undefined, 'tema']
 */
export function restorePositions(original: CommandSchema, hidden: readonly string[], given: unknown[]): unknown[] {
  const queue = [...given];
  const positional = original.parameters.map((parameter) =>
    hidden.includes(parameter.name) ? undefined : queue.shift(),
  );
  while (positional.length > 0 && positional[positional.length - 1] === undefined) positional.pop();
  return positional;
}
