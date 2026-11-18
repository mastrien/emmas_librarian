/**
 * `--name value` pairs of a command line as an object; a flag with no value is "true".
 *
 * Usage:
 *   flagsOf(['--model', 'qwen3.5-4b', '--cases', 'art-2,proj-1']); // { model: 'qwen3.5-4b', cases: 'art-2,proj-1' }
 */
export function flagsOf(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let at = 0; at < argv.length; at++) {
    if (!argv[at].startsWith('--'))
      throw new Error(`[ERR_BAD_FLAG] Offending value: ${JSON.stringify(argv[at])}. Expected --name [value].`);
    const next = argv[at + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    flags[argv[at].slice(2)] = hasValue ? next : 'true';
    if (hasValue) at++;
  }
  return flags;
}
