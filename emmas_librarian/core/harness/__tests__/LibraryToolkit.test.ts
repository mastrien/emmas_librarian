import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { AppError } from '../../errors/AppError';
import { LibraryToolkit } from '../LibraryToolkit';
import type { CommandSchema } from '../commandSchema';
import { TrajectoryLog } from '../trajectory';
import { MemorySink } from './support/MemorySink';
import { FakeConfirmer } from './support/FakeConfirmer';
import type { Access } from '../toolAccess';

const schema = (name: string, parameters: CommandSchema['parameters'] = []): CommandSchema => ({
  name,
  parameters,
  source: 'test',
});
const projectId = { name: 'projectId', required: true, schema: { type: 'number' as const } };

const READ: Access = { confirm: false, localOnly: false };
const ASKS: Access = { confirm: true, localOnly: false };
const ACCESS = new Map<string, Access>([
  ['projects:getOne', READ],
  ['projects:delete', ASKS],
  ['projects:explode', READ],
]);

let commands: CommandRegistry;
let sink: MemorySink;
let ran: ReturnType<typeof vi.fn>;
let toolkit: LibraryToolkit;

beforeEach(() => {
  ran = vi.fn();
  commands = new CommandRegistry();
  commands.add('projects:getOne', (projectId: number) => (ran(projectId), { id: projectId }));
  commands.add('projects:delete', (projectId: number) => (ran(projectId), undefined));
  commands.add('settings:get', (key: string) => key);
  commands.add('projects:explode', () => {
    throw new AppError('ERR_NOT_FOUND', 'USER_ERROR', '[ERR_NOT_FOUND] Projeto não encontrado. Offending value: 9');
  });
  sink = new MemorySink();
  toolkit = new LibraryToolkit({
    commands,
    access: ACCESS,
    confirmer: new FakeConfirmer(true),
    log: new TrajectoryLog(sink),
    clock: () => 100,
    schemas: [
      schema('projects:getOne', [projectId]),
      schema('projects:delete', [projectId]),
      schema('settings:get', [{ name: 'key', required: true, schema: { type: 'string' } }]),
      schema('projects:explode'),
      schema('not:registered'),
    ],
  });
});

describe('LibraryToolkit: what the model is offered', () => {
  it('lists a tool for each command that has a schema, is registered and is not kept back', () => {
    expect(toolkit.tools().map((tool) => tool.name)).toEqual([
      'projects__getOne',
      'projects__delete',
      'projects__explode',
    ]);
  });

  it('describes the arguments of a tool as the JSON schema of an object', () => {
    expect(toolkit.tools()[0].input_schema).toEqual({
      type: 'object',
      properties: { projectId: { type: 'number' } },
      required: ['projectId'],
      additionalProperties: false,
    });
  });

  // Regression: the harness offered pdf:get and the highlight commands, which the CLI keeps for the PDF reader.
  it('keeps back what the CLI keeps for the desktop app, saying why', () => {
    const channel = 'pdf:get';
    commands.add(channel, (articleId: number) => articleId);
    const withPdf = new LibraryToolkit({
      commands,
      access: new Map([[channel, READ]]),
      schemas: [schema(channel, [{ name: 'articleId', required: true, schema: { type: 'number' } }])],
    });

    expect(withPdf.tools()).toEqual([]);
    expect(withPdf.hidden()).toEqual([{ name: channel, reason: expect.stringContaining('desktop app on screen') }]);
  });

  it('keeps back the commands that hand over the API keys, saying why', () => {
    expect(toolkit.hidden()).toEqual([{ name: 'settings:get', reason: 'returns and sets the API keys of the person' }]);
  });
});

describe('LibraryToolkit: a call', () => {
  it('runs the command with the arguments in its order and answers the result', async () => {
    expect(await toolkit.call('projects__getOne', { projectId: 3 })).toEqual({ ok: true, result: { id: 3 } });
    expect(ran).toHaveBeenCalledWith(3);
  });

  it('answers null for a command that answers nothing, as the CLI does', async () => {
    expect(await toolkit.call('projects__delete', { projectId: 3 })).toEqual({ ok: true, result: null });
  });

  // Regression of the CLI (`articles:getByProject abc` -> ok:true, []): the command must not run at all.
  it('refuses a wrong argument without running the command', async () => {
    const answer = await toolkit.call('projects__getOne', { projectId: 'abc' });

    expect(answer).toMatchObject({ ok: false, error: { code: 'ERR_INVALID_ARGUMENTS', type: 'VALIDATION_ERROR' } });
    expect(ran).not.toHaveBeenCalled();
  });

  it.each(['settings__get', 'not__registered', 'nope__nada'])(
    'refuses the tool %s as unknown, never running it',
    async (name) => {
      const answer = await toolkit.call(name, { key: 'api_key' });

      expect(answer).toMatchObject({ ok: false, error: { code: 'ERR_UNKNOWN_TOOL' } });
    },
  );

  it('answers a failure of the command as an error with its code, type and message', async () => {
    expect(await toolkit.call('projects__explode', {})).toEqual({
      ok: false,
      error: {
        code: 'ERR_NOT_FOUND',
        type: 'USER_ERROR',
        message: '[ERR_NOT_FOUND] Projeto não encontrado. Offending value: 9',
      },
    });
  });
});

describe('LibraryToolkit: the trajectory', () => {
  it('records each call, the wrong ones too, in order, one JSON line each', async () => {
    await toolkit.call('projects__getOne', { projectId: 3 });
    await toolkit.call('projects__getOne', { projectId: 'abc' });

    expect(sink.steps()).toMatchObject([
      { step: 1, tool: 'projects__getOne', input: { projectId: 3 }, ok: true, output: { id: 3 }, durationMs: 0 },
      {
        step: 2,
        tool: 'projects__getOne',
        input: { projectId: 'abc' },
        ok: false,
        output: { code: 'ERR_INVALID_ARGUMENTS' },
      },
    ]);
  });
});

describe('LibraryToolkit: what needs the person to say yes', () => {
  const build = (confirmer?: FakeConfirmer, modelIsLocal = false) =>
    new LibraryToolkit({
      commands,
      access: ACCESS,
      confirmer,
      modelIsLocal,
      schemas: [schema('projects:getOne', [projectId]), schema('projects:delete', [projectId])],
    });

  it('asks the person with the tool and the arguments, and runs the command after a yes', async () => {
    const confirmer = new FakeConfirmer(true);
    const answer = await build(confirmer).call('projects__delete', { projectId: 3 });

    expect(answer.ok).toBe(true);
    expect(confirmer.asked).toEqual([
      { tool: 'projects__delete', command: 'projects:delete', input: { projectId: 3 } },
    ]);
    expect(ran).toHaveBeenCalledWith(3);
  });

  it('does not run the command after a no, and says so with the code the model can read', async () => {
    const answer = await build(new FakeConfirmer(false)).call('projects__delete', { projectId: 3 });

    expect(answer).toMatchObject({ ok: false, error: { code: 'ERR_NOT_CONFIRMED', type: 'USER_ERROR' } });
    expect(ran).not.toHaveBeenCalled();
  });

  it('refuses when nobody can be asked', async () => {
    const answer = await build().call('projects__delete', { projectId: 3 });

    expect(answer).toMatchObject({ ok: false, error: { code: 'ERR_NOT_CONFIRMED' } });
    expect(ran).not.toHaveBeenCalled();
  });

  it('does not bother the person for a read', async () => {
    const confirmer = new FakeConfirmer(false);
    await build(confirmer).call('projects__getOne', { projectId: 3 });

    expect(confirmer.asked).toEqual([]);
  });

  it('does not ask about a call whose arguments are wrong', async () => {
    const confirmer = new FakeConfirmer(true);
    const answer = await build(confirmer).call('projects__delete', { projectId: 'x' });

    expect(answer).toMatchObject({ ok: false, error: { code: 'ERR_INVALID_ARGUMENTS' } });
    expect(confirmer.asked).toEqual([]);
  });
});

describe('LibraryToolkit: what only a local model is offered', () => {
  const local: Access = { confirm: false, localOnly: true };
  const build = (modelIsLocal: boolean) =>
    new LibraryToolkit({
      commands,
      access: new Map([['projects:getOne', local]]),
      modelIsLocal,
      schemas: [schema('projects:getOne', [projectId])],
    });

  it('keeps it from a model in the cloud, saying why', () => {
    expect(build(false).tools()).toEqual([]);
    expect(build(false).hidden()).toEqual([{ name: 'projects:getOne', reason: expect.stringContaining('locally') }]);
  });

  it('offers it to a model that runs locally', () => {
    expect(
      build(true)
        .tools()
        .map((tool) => tool.name),
    ).toEqual(['projects__getOne']);
  });
});
