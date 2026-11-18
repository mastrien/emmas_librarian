// A command is `articles:getByProject`; the tool APIs accept letters, digits, `_` and `-` only (64 at most).
const SEPARATOR = '__';
const VALID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The name a model calls a command by. Reversible: `fromToolName(toToolName(name)) === name`.
 *
 * Usage:
 *   toToolName('articles:getByProject'); // 'articles__getByProject'
 */
export function toToolName(commandName: string): string {
  const toolName = commandName.replaceAll(':', SEPARATOR);
  if (VALID.test(toolName) && !commandName.includes(SEPARATOR)) return toolName;
  throw new Error(
    `Command "${commandName}" cannot be a tool name. Offending value: "${toolName}". Expected shape: letters, digits, "_" or "-", up to 64, and no "${SEPARATOR}" of its own`,
  );
}

export const fromToolName = (toolName: string): string => toolName.replaceAll(SEPARATOR, ':');
