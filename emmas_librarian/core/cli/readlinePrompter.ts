import readline from 'node:readline';
import type { Prompter } from './terminalConfirmer';

/**
 * A prompter over a pair of Node streams (the terminal's stdin and stdout). Lines that arrive before the question is
 * asked are kept, so a pipe (`printf 's\n' | ...`) answers the first question it meets. When the input ends with no line
 * left, the answer is null, so a closed terminal never approves anything.
 *
 * Usage:
 *   const prompter = new ReadlinePrompter(process.stdin, process.stderr);
 */
export class ReadlinePrompter implements Prompter {
  private readonly pending: string[] = [];
  private waiting: ((line: string | null) => void) | undefined;
  private closed = false;

  constructor(
    input: NodeJS.ReadableStream,
    private readonly output: NodeJS.WritableStream,
  ) {
    const lines = readline.createInterface({ input, terminal: false });
    lines.on('line', (line) => this.receive(line));
    lines.on('close', () => this.end());
  }

  ask(question: string): Promise<string | null> {
    this.output.write(question);
    const early = this.pending.shift();
    if (early !== undefined) return Promise.resolve(early);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => (this.waiting = resolve));
  }

  private receive(line: string): void {
    const waiting = this.waiting;
    this.waiting = undefined;
    if (waiting) waiting(line);
    else this.pending.push(line);
  }

  private end(): void {
    this.closed = true;
    this.waiting?.(null);
    this.waiting = undefined;
  }
}
