// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { LibraryToolkit } from '../../harness/LibraryToolkit';
import { TerminalConfirmer, describeRequest, isYes, type Prompter } from '../terminalConfirmer';
import { ReadlinePrompter } from '../readlinePrompter';

/** Answers with the lines it was given, in order, and remembers the questions. */
class ScriptedPrompter implements Prompter {
  readonly questions: string[] = [];
  constructor(private readonly answers: Array<string | null>) {}
  async ask(question: string): Promise<string | null> {
    this.questions.push(question);
    return this.answers.shift() ?? null;
  }
}

const request = { tool: 'projects__delete', command: 'projects:delete', input: { id: 3 } };

describe('isYes', () => {
  it.each(['s', 'S', 'sim', ' Sim ', 'y', 'yes'])('accepts %j', (answer) => expect(isYes(answer)).toBe(true));
  it.each(['', 'n', 'não', 'talvez', 'ok', 'ss'])('refuses %j', (answer) => expect(isYes(answer)).toBe(false));
  it('refuses when the input ended', () => expect(isYes(null)).toBe(false));
});

describe('describeRequest', () => {
  it('names the command and the arguments, and warns the library changes', () => {
    const text = describeRequest(request);
    expect(text).toContain('"projects:delete"');
    expect(text).toContain('{"id":3}');
    expect(text).toContain('muda a biblioteca');
  });

  it('cuts a very long argument and says how long it was', () => {
    const text = describeRequest({ ...request, input: { content: 'x'.repeat(500) } });
    expect(text).toMatch(/… \(5\d\d caracteres\)/);
    expect(text.length).toBeLessThan(400);
  });

  it('shows a call with no arguments', () => {
    expect(describeRequest({ ...request, input: undefined })).toContain('sem argumentos');
  });
});

describe('TerminalConfirmer', () => {
  it('approves only an explicit yes', async () => {
    const prompter = new ScriptedPrompter(['s', 'n', '', null]);
    const confirmer = new TerminalConfirmer(prompter);
    expect(await confirmer.confirm(request)).toBe(true);
    expect(await confirmer.confirm(request)).toBe(false);
    expect(await confirmer.confirm(request)).toBe(false);
    expect(await confirmer.confirm(request)).toBe(false);
    expect(prompter.questions).toHaveLength(4);
  });

  it('denies when the terminal fails instead of asking', async () => {
    const broken: Prompter = { ask: () => Promise.reject(new Error('stdin closed')) };
    expect(await new TerminalConfirmer(broken).confirm(request)).toBe(false);
  });
});

describe('a call that changes the library, through the toolkit and the terminal', () => {
  function build(answers: Array<string | null>) {
    const ran: number[] = [];
    const commands = new CommandRegistry();
    commands.add('projects:delete', (id: number) => void ran.push(id));
    const toolkit = new LibraryToolkit({
      commands,
      confirmer: new TerminalConfirmer(new ScriptedPrompter(answers)),
      access: new Map([['projects:delete', { confirm: true, localOnly: false }]]),
      schemas: [
        {
          name: 'projects:delete',
          parameters: [{ name: 'id', required: true, schema: { type: 'number' } }],
          source: 't',
        },
      ],
    });
    return { toolkit, ran };
  }

  // Regression guard for #199: nothing with `confirm` runs unless a person typed yes.
  it.each([['n'], [''], [null]])('does not run it when the answer is %j', async (answer) => {
    const { toolkit, ran } = build([answer]);
    const result = await toolkit.call('projects__delete', { id: 3 });
    expect(result.ok).toBe(false);
    expect(ran).toEqual([]);
  });

  it('runs it after a yes', async () => {
    const { toolkit, ran } = build(['s']);
    expect((await toolkit.call('projects__delete', { id: 3 })).ok).toBe(true);
    expect(ran).toEqual([3]);
  });
});

describe('ReadlinePrompter', () => {
  it('writes the question and returns the next line', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const prompter = new ReadlinePrompter(input, output);
    const answer = prompter.ask('Executar? ');
    input.write('sim\n');
    expect(await answer).toBe('sim');
    expect(output.read().toString()).toBe('Executar? ');
  });

  it('answers null when the input ends before a line, and keeps answering null', async () => {
    const input = new PassThrough();
    const prompter = new ReadlinePrompter(input, new PassThrough());
    const answer = prompter.ask('?');
    input.end();
    expect(await answer).toBeNull();
    expect(await prompter.ask('?')).toBeNull();
  });

  // A pipe delivers its line before the first question is asked; the first version dropped it and answered null.
  it('answers with a line that arrived before the question, and then with the next ones in order', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const prompter = new ReadlinePrompter(input, output);
    input.write('s\nn\n');
    await new Promise((resolve) => setImmediate(resolve));
    expect(await prompter.ask('1? ')).toBe('s');
    expect(await prompter.ask('2? ')).toBe('n');
    expect(output.read().toString()).toBe('1? 2? ');
  });

  it('still answers a line it kept after the input ended, and null only after that', async () => {
    const input = new PassThrough();
    const prompter = new ReadlinePrompter(input, new PassThrough());
    input.end('sim\n');
    await new Promise((resolve) => setImmediate(resolve));
    expect(await prompter.ask('?')).toBe('sim');
    expect(await prompter.ask('?')).toBeNull();
  });
});
