import type { RegisteredCommand } from '../commands/CommandRegistry';
import type { CommandSchema } from './commandSchema';
import type { Access } from './toolAccess';

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

const NOT_ALLOWED = 'not offered to a model: nobody decided it should be (see docs/harness.md)';
export const NEEDS_LOCAL_MODEL = 'sends text or queries to a third party: only offered with a model that runs locally';

const FILE_PARAMETER = /filePath/i;

export interface PolicyInput {
  command: RegisteredCommand;
  schema: CommandSchema;
  /** Whether the CLI offers it: what a terminal cannot run is not offered to a model either. */
  inTerminal: boolean;
  /** Undefined when nobody decided that a model may use the command. */
  access: Access | undefined;
  modelIsLocal: boolean;
}

/**
 * The reason a command is not offered to a model, or undefined when it is. It must be allowed in TOOL_ACCESS and
 * be something the CLI gives a person; one that reads or writes a file the caller names stays hidden too (a model
 * should not choose where on the disk to write), and one that sends text to a third party needs a local model.
 *
 * Usage:
 *   whyHidden({ command, schema, inTerminal: true, access: undefined, modelIsLocal: false }); // 'returns and sets the API keys...'
 */
export function whyHidden({ command, schema, inTerminal, access, modelIsLocal }: PolicyInput): string | undefined {
  if (!inTerminal) return 'needs the desktop app on screen (the PDF reader: its bytes and the marks it positions)';
  if (!access) return DEFAULT_EXCLUSIONS.find(({ pattern }) => pattern.test(command.name))?.reason ?? NOT_ALLOWED;
  const hidden = access.hideParameters ?? [];
  const asksForPath = schema.parameters.some((p) => FILE_PARAMETER.test(p.name) && !hidden.includes(p.name));
  if ((command.file && hidden.length === 0) || asksForPath) {
    return 'reads or writes a file at a path the caller chooses';
  }
  if (access.localOnly && !modelIsLocal) return NEEDS_LOCAL_MODEL;
  return undefined;
}
