export type EvalKind = 'happy' | 'trap' | 'refusal' | 'error';

/** What the evaluation tells the harness about the moment the request is made. */
export interface EvalContext {
  focusProject?: { id: number; name: string };
  /** Today, as the library writes it (2026-11-15). */
  today?: string;
  /** Defaults to true: the evaluation is about models that run on this machine first. */
  modelIsLocal?: boolean;
  /** What the person answers when asked to approve a change. Defaults to "yes". */
  confirm?: 'yes' | 'no';
}

export interface EvalCall {
  tool: string;
  /** The arguments of the ideal call; null when any well-formed arguments will do. */
  input: unknown;
}

export interface EvalCheck {
  check: string;
  args?: Record<string, unknown>;
}

export interface EvalCase {
  id: string;
  kind: EvalKind;
  prompt: string;
  context: EvalContext;
  expect: {
    /** The ideal trajectory, in order. Empty for a refusal. */
    calls: EvalCall[];
    /** Tools that must not exist for the model in this context: the toolkit must not offer them. */
    forbidden: string[];
    /** Tools that exist but the model must not call here (a made-up id, a project nobody chose). */
    mustNotCall?: string[];
    /** What the answer to the person must say, for a judge to read; not compared as text. */
    reply: string;
    /** Error codes the ideal trajectory runs into on the way. */
    errors: string[];
  };
  /** What must be true of the library when the episode ends. */
  checks: EvalCheck[];
  /** False when the ideal trajectory needs the network or an AI model, so it cannot run offline. */
  solvable?: boolean;
}

const KINDS: readonly EvalKind[] = ['happy', 'trap', 'refusal', 'error'];

function invalidCase(line: number, what: string, value: unknown): Error {
  const shown = JSON.stringify(value)?.slice(0, 120) ?? String(value);
  return new Error(
    `[ERR_INVALID_EVAL_CASE] Line ${line}: ${what}. Offending value: ${shown}. Expected an EvalCase (see evalCase.ts).`,
  );
}

function parseLine(text: string, line: number): EvalCase {
  let parsed: Partial<EvalCase>;
  try {
    parsed = JSON.parse(text) as Partial<EvalCase>;
  } catch {
    throw invalidCase(line, 'not JSON', text);
  }
  if (typeof parsed.id !== 'string' || parsed.id === '') throw invalidCase(line, 'no id', parsed.id);
  if (!KINDS.includes(parsed.kind as EvalKind)) throw invalidCase(line, 'unknown kind', parsed.kind);
  if (typeof parsed.prompt !== 'string' || parsed.prompt === '') throw invalidCase(line, 'no prompt', parsed.prompt);
  if (!parsed.expect || !Array.isArray(parsed.expect.calls)) throw invalidCase(line, 'no expect.calls', parsed.expect);
  if (!Array.isArray(parsed.checks)) throw invalidCase(line, 'no checks list', parsed.checks);
  return parsed as EvalCase;
}

/**
 * Reads the evaluation set: one JSON case per line, ids unique. No model is called anywhere here.
 *
 * Usage:
 *   const cases = parseEvalCases(fs.readFileSync('core/harness/eval/cases.jsonl', 'utf-8'));
 */
export function parseEvalCases(text: string): EvalCase[] {
  const cases = text
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line !== '')
    .map(({ line, number }) => parseLine(line, number));
  const seen = new Set<string>();
  for (const { id } of cases) {
    if (seen.has(id)) throw invalidCase(0, 'duplicate id', id);
    seen.add(id);
  }
  return cases;
}
