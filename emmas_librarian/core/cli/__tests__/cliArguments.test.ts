import { describe, it, expect } from 'vitest';
import { parseCliArguments } from '../cliArguments';

const plain = { pretty: false };

describe('parseCliArguments', () => {
  it.each([[[]], [['help']], [['--help']], [['-h']], [['commands', '--help']]])(
    'asks for the general usage text for %j',
    (argv) => {
      expect(parseCliArguments(argv)).toEqual({ kind: 'help', options: plain });
    },
  );

  it('asks for the usage of one command when --help comes with it', () => {
    expect(parseCliArguments(['diary:save', '--help'])).toEqual({
      kind: 'help',
      command: 'diary:save',
      options: plain,
    });
  });

  it('lists the commands for `commands`', () => {
    expect(parseCliArguments(['commands'])).toEqual({ kind: 'list', options: plain });
  });

  it('takes the first word as the command and the rest as its arguments', () => {
    expect(parseCliArguments(['projects:update', '3', 'Tese final'])).toEqual({
      kind: 'run',
      command: 'projects:update',
      args: [3, 'Tese final'],
      options: plain,
    });
  });

  it('reads each argument as JSON when it parses and as text otherwise', () => {
    const request = parseCliArguments(['x', '3', 'true', 'null', '[1,2]', '{"a":1}', '"123"', 'Minha tese', './a.csv']);

    expect(request).toMatchObject({ args: [3, true, null, [1, 2], { a: 1 }, '123', 'Minha tese', './a.csv'] });
  });

  it('takes the arguments from --args-json exactly as given', () => {
    expect(parseCliArguments(['diary:save', '--args-json', '[1, "2026-11-14", "texto"]'])).toMatchObject({
      command: 'diary:save',
      args: [1, '2026-11-14', 'texto'],
    });
  });

  it('reads the options wherever they appear', () => {
    expect(parseCliArguments(['--pretty', 'projects:getOne', '--data-dir', '/lib', '3'])).toEqual({
      kind: 'run',
      command: 'projects:getOne',
      args: [3],
      options: { pretty: true, dataDir: '/lib' },
    });
  });

  // Regression: `--data-dir=X` used to become a positional argument, so the command ran on the app's own
  // library instead of X, with no warning.
  it('reads --data-dir=<folder> and --args-json=<array> written with an equals sign', () => {
    expect(parseCliArguments(['diary:save', '--args-json=[1,"2026-11-14","a=b"]', '--data-dir=/lib'])).toEqual({
      kind: 'run',
      command: 'diary:save',
      args: [1, '2026-11-14', 'a=b'],
      options: { pretty: false, dataDir: '/lib' },
    });
  });

  it('takes everything after -- as arguments, even what looks like an option', () => {
    expect(parseCliArguments(['--pretty', '--', 'diary:save', '3', '--', '--pretty'])).toEqual({
      kind: 'run',
      command: 'diary:save',
      args: [3, '--', '--pretty'],
      options: { pretty: true },
    });
  });

  it('keeps -- from hiding a missing command', () => {
    expect(parseCliArguments(['--'])).toEqual({ kind: 'help', options: plain });
  });

  it('keeps a value with an equals sign or a single dash as an argument', () => {
    expect(parseCliArguments(['settings:set', 'a=b', '-1'])).toMatchObject({ args: ['a=b', -1] });
  });

  it.each([
    [['x', '--args-json', '{"a":1}'], '--args-json inválido. Offending value: "{\\"a\\":1}"'],
    [['x', '--args-json'], '--args-json inválido. Offending value: undefined'],
    [['x', '--data-dir'], '--data-dir sem valor. Offending value: undefined'],
    [['x', '--data-dir', '--pretty'], '--data-dir sem valor. Offending value: "--pretty"'],
    [['x', '1', '--args-json', '[2]'], 'Argumentos dados duas vezes. Offending value: ["1"]'],
    [['projects:getAll', '--nao-existe'], 'Opção desconhecida. Offending value: "--nao-existe"'],
    [['projects:getAll', '--pretty=true'], 'Opção desconhecida. Offending value: "--pretty=true"'],
    [['diary:save', '3', '---'], 'Opção desconhecida. Offending value: "---"'],
  ])('refuses %j as a usage error naming the value', (argv, problem) => {
    const failure = (() => {
      try {
        return parseCliArguments(argv);
      } catch (error) {
        return error;
      }
    })();

    expect(failure).toMatchObject({ code: 'ERR_CLI_USAGE', type: 'VALIDATION_ERROR' });
    expect((failure as Error).message).toContain(problem);
  });

  describe('ask', () => {
    it('reads the question, and joins the words a shell split', () => {
      expect(parseCliArguments(['ask', '--', 'Quais projetos eu tenho?'])).toEqual({
        kind: 'ask',
        question: 'Quais projetos eu tenho?',
        options: { pretty: false },
      });
      expect(parseCliArguments(['ask', 'Quais', 'projetos'])).toMatchObject({ question: 'Quais projetos' });
    });

    it('reads --text, --models-dir and --llama-server, with = or a space', () => {
      const request = parseCliArguments([
        'ask',
        '--text',
        '--models-dir=/m',
        '--llama-server',
        '/bin/llama-server',
        '--',
        'oi',
      ]);
      expect(request).toMatchObject({
        kind: 'ask',
        question: 'oi',
        options: { text: true, modelsDir: '/m', llamaServer: '/bin/llama-server' },
      });
    });

    it('refuses --args-json, which is for the other commands, naming it', () => {
      expect(() => parseCliArguments(['ask', '--args-json=["oi"]'])).toThrow(
        /--args-json não vale para ask.*\["oi"\]/s,
      );
    });

    it('refuses --models-dir with no value', () => {
      expect(() => parseCliArguments(['ask', '--models-dir'])).toThrow(/--models-dir sem valor/);
    });
  });
});
