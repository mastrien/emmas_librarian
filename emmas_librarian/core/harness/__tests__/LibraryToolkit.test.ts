import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { AppError } from '../../errors/AppError';
import { LibraryToolkit } from '../LibraryToolkit';
import type { CommandSchema } from '../commandSchema';
import { TrajectoryLog } from '../trajectory';
import { MemorySink } from './support/MemorySink';

const schema = (name: string, parameters: CommandSchema['parameters'] = []): CommandSchema => ({
  name,
  parameters,
  source: 'test',
});
const projectId = { name: 'projectId', required: true, schema: { type: 'number' as const } };

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
