import type { ConfirmRequest, Confirmer } from '../harness/confirmer';

/** Where the person types: one question, one line back, or null when there is nothing to read (the input ended). */
export interface Prompter {
  ask(question: string): Promise<string | null>;
}

const YES = new Set(['s', 'sim', 'y', 'yes']);
const MAX_ARGUMENT_CHARS = 200;

/** Only an explicit yes counts; an empty line, anything else and the end of the input are all a no. */
export function isYes(answer: string | null): boolean {
  return answer !== null && YES.has(answer.trim().toLowerCase());
}

function shown(input: unknown): string {
  const text = JSON.stringify(input) ?? 'sem argumentos';
  return text.length > MAX_ARGUMENT_CHARS ? `${text.slice(0, MAX_ARGUMENT_CHARS)}… (${text.length} caracteres)` : text;
}

/** The question a person reads before a call that changes the library: what runs and with which arguments. */
export function describeRequest(request: ConfirmRequest): string {
  return `O agente quer executar "${request.command}" com ${shown(request.input)}. Isso muda a biblioteca. Executar? [s/N] `;
}

/**
 * Asks on the terminal before each call that changes the library. There is no way to answer yes ahead of time: a person
 * who wants to automate uses the CLI commands directly (#199).
 *
 * Usage:
 *   const toolkit = new LibraryToolkit({ commands, confirmer: new TerminalConfirmer(prompter) });
 */
export class TerminalConfirmer implements Confirmer {
  constructor(private readonly prompter: Prompter) {}

  async confirm(request: ConfirmRequest): Promise<boolean> {
    try {
      return isYes(await this.prompter.ask(describeRequest(request)));
    } catch {
      return false;
    }
  }
}
