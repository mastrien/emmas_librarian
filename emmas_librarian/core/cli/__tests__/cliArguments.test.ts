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

  it.each([
    [['x', '--args-json', '{"a":1}'], '--args-json inválido. Offending value: "{\\"a\\":1}"'],
    [['x', '--args-json'], '--args-json inválido. Offending value: undefined'],
    [['x', '--data-dir'], '--data-dir sem valor. Offending value: undefined'],
    [['x', '--data-dir', '--pretty'], '--data-dir sem valor. Offending value: "--pretty"'],
    [['x', '1', '--args-json', '[2]'], 'Argumentos dados duas vezes. Offending value: ["1"]'],
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
});
