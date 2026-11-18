import readline from 'node:readline';
import type { Prompter } from './terminalConfirmer';

/**
 * A prompter over a pair of Node streams (the terminal's stdin and stdout). When the input ends before an answer, the
 * answer is null, so a pipe or a closed terminal never approves anything.
 *
 * Usage:
 *   const prompter = new ReadlinePrompter(process.stdin, process.stderr);
 */
export class ReadlinePrompter implements Prompter {
  private readonly lines: readline.Interface;
  private closed = false;

  constructor(
    input: NodeJS.ReadableStream,
    private readonly output: NodeJS.WritableStream,
  ) {
    this.lines = readline.createInterface({ input, terminal: false });
    this.lines.on('close', () => (this.closed = true));
  }

  ask(question: string): Promise<string | null> {
    if (this.closed) return Promise.resolve(null);
    this.output.write(question);
    return new Promise((resolve) => {
      const onClose = (): void => resolve(null);
      this.lines.once('close', onClose);
      this.lines.once('line', (line) => {
        this.lines.off('close', onClose);
        resolve(line);
      });
    });
  }
}
