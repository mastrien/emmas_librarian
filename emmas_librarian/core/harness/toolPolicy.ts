import type { RegisteredCommand } from '../commands/CommandRegistry';
import type { CommandSchema } from './commandSchema';

interface Exclusion {
  /** Matches the command name. */
  pattern: RegExp;
  reason: string;
}

/**
 * What a model must not be handed by default, and why. A name that stops matching any command is
 * caught by a test, so this list cannot rot into rules about commands that no longer exist.
 */
export const DEFAULT_EXCLUSIONS: Exclusion[] = [
  { pattern: /^settings:/, reason: 'returns and sets the API keys of the person' },
  { pattern: /^aiModelConfig:/, reason: 'changes which AI provider and key the app uses' },
  { pattern: /^backup:restore/, reason: 'replaces or merges the whole library' },
  {
    pattern: /^ai:|^ask:(send|indexMissing)$|^screening:(suggest|vectorsGenerate)$/,
    reason: 'calls an AI model: cost, and text sent to a third party',
  },
  {
    pattern: /^search:(preview|peekCitations|previewCitations)$|^searchMonitor:check$|^pdf:fetchOpenAccess$/,
    reason: 'calls the network (bibliographic bases, repositories)',
  },
];

const FILE_PARAMETER = /filePath/i;

/**
 * The reason a command is not offered to a model, or undefined when it is. A command that reads or
 * writes a file the caller names is hidden too: a model should not choose where on the disk to write.
 *
 * Usage:
 *   whyHidden(commands.get('settings:get'), schema); // 'returns and sets the API keys of the person'
 */
export function whyHidden(command: RegisteredCommand, schema: CommandSchema): string | undefined {
  const exclusion = DEFAULT_EXCLUSIONS.find(({ pattern }) => pattern.test(command.name));
  if (exclusion) return exclusion.reason;
  if (command.file || schema.parameters.some((parameter) => FILE_PARAMETER.test(parameter.name))) {
    return 'reads or writes a file at a path the caller chooses';
  }
  return undefined;
}
