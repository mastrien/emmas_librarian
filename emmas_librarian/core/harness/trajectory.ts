/** One tool call of an episode, as it is stored: enough to replay it and to learn from it. */
export interface TrajectoryStep {
  step: number;
  tool: string;
  input: unknown;
  ok: boolean;
  /** The result of the command, or the error `{ code, type, message }`. */
  output: unknown;
  durationMs: number;
}

/** Where steps go: a file in production, a list in tests. */
export interface TrajectorySink {
  write(line: string): void;
}

/**
 * Records every tool call of an episode as one JSON line, the format a fine-tuning set is built from.
 *
 * Usage:
 *   const log = new TrajectoryLog(new FileSink('episode-1.jsonl'));
 *   log.record({ tool: 'projects__getAll', input: {}, ok: true, output: [], durationMs: 3 });
 */
export class TrajectoryLog {
  private count = 0;

  constructor(private readonly sink: TrajectorySink) {}

  record(step: Omit<TrajectoryStep, 'step'>): void {
    this.count += 1;
    this.sink.write(JSON.stringify({ step: this.count, ...step }));
  }
}
