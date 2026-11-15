import type { TrajectorySink } from '../../trajectory';

/** A trajectory sink that keeps the lines in memory instead of writing a file. */
export class MemorySink implements TrajectorySink {
  readonly lines: string[] = [];

  write(line: string): void {
    this.lines.push(line);
  }

  steps(): Array<Record<string, unknown>> {
    return this.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}
