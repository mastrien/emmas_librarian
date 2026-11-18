// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { decidedConfig } from '../eval/decision/decidedSetup';
import { changedLibrary, runDecidedEpisode, type DecidedEpisodeInput } from '../eval/decision/decidedEpisode';
import { LibraryToolkit } from '../LibraryToolkit';
import type { ToolArea } from '../toolAreas';
import { FakeConfirmer } from './support/FakeConfirmer';
import { FakeDecisionModel } from './support/FakeDecisionModel';
import { ScriptedChat, reply } from './support/ScriptedChat';

const READ = { confirm: false, localOnly: false };
const ASKS = { confirm: true, localOnly: false };
const number = { type: 'number' as const };
const AREAS: ToolArea[] = [
  { id: 'projetos', about: 'projetos', commands: ['projects:getAll', 'projects:delete'] },
  { id: 'diario', about: 'diário', commands: ['diary:getOne'] },
];

function library(): LibraryToolkit {
  const commands = new CommandRegistry();
  commands.add('projects:getAll', () => [{ id: 1 }]);
  commands.add('projects:delete', (id: number) => id);
  commands.add('diary:getOne', (id: number) => ({ id }));
  return new LibraryToolkit({
    commands,
    confirmer: new FakeConfirmer(true),
    access: new Map([
      ['projects:getAll', READ],
      ['projects:delete', ASKS],
      ['diary:getOne', READ],
    ]),
    schemas: [
      { name: 'projects:getAll', parameters: [], source: 't' },
      { name: 'projects:delete', parameters: [{ name: 'id', required: true, schema: number }], source: 't' },
      { name: 'diary:getOne', parameters: [{ name: 'id', required: true, schema: number }], source: 't' },
    ],
  });
}

const call = (name: string, args = '{}') => reply({ toolCalls: [{ id: `c-${name}`, name, arguments: args }] });
const said = (content: string) => reply({ content });
const inputFor = (
  chat: ScriptedChat,
  decider: FakeDecisionModel,
  over: Partial<DecidedEpisodeInput> = {},
): DecidedEpisodeInput => ({
  system: 'sistema',
  prompt: 'Quais projetos eu tenho?',
  toolkit: library(),
  chat,
  sampling: { temperature: 0 },
  maxSteps: 3,
  decider,
  areas: AREAS,
  topAreas: 1,
  minConfidence: 0.6,
  ...over,
});
const toolNames = (chat: ScriptedChat, at: number): string[] => chat.asked[at].tools.map((tool) => tool.function.name);

describe('runDecidedEpisode', () => {
  it('gives the model only the tools of the chosen subject, with no way to choose subjects, and stops there', async () => {
    const chat = new ScriptedChat([call('projects__getAll'), said('Um projeto.')]);
    const decider = new FakeDecisionModel({ projetos: 0.9, diario: 0.1 });
    const record = await runDecidedEpisode(inputFor(chat, decider));
    expect(toolNames(chat, 0)).toEqual(['projects__getAll', 'projects__delete']);
    expect(record).toMatchObject({ stopped: 'answered', finalText: 'Um projeto.' });
    expect(record.decision).toMatchObject({
      chosen: ['projetos'],
      fallback: 'none',
      decisionMs: 3,
      decisionInputTokens: 50,
    });
    expect(Object.keys(decider.asked[0].questions)).toEqual(['assunto']);
    expect(chat.asked).toHaveLength(2);
  });

  it('offers the tools of as many subjects as asked, most probable first', async () => {
    const chat = new ScriptedChat([said('ok')]);
    await runDecidedEpisode(
      inputFor(chat, new FakeDecisionModel({ projetos: 0.6, diario: 0.4 }), { topAreas: 2, minConfidence: 0.5 }),
    );
    expect(toolNames(chat, 0)).toEqual(['projects__getAll', 'projects__delete', 'diary__getOne']);
  });

  it('runs the whole toolkit when the router is not sure of its best subject', async () => {
    const chat = new ScriptedChat([said('ok')]);
    const record = await runDecidedEpisode(inputFor(chat, new FakeDecisionModel({ projetos: 0.5, diario: 0.5 })));
    expect(toolNames(chat, 0)).toEqual(['projects__getAll', 'projects__delete', 'diary__getOne']);
    expect(record.decision).toMatchObject({ fallback: 'low-confidence', chosen: [] });
    expect(record.decision?.ranked).toHaveLength(2);
  });

  it('runs the whole toolkit when the decision model fails', async () => {
    const chat = new ScriptedChat([said('ok')]);
    const record = await runDecidedEpisode(inputFor(chat, new FakeDecisionModel(new Error('server down'))));
    expect(toolNames(chat, 0)).toHaveLength(3);
    expect(record.decision).toMatchObject({ fallback: 'decision-error', ranked: [], decisionMs: 0 });
  });

  it('starts again with the whole toolkit when the restricted attempt gets nowhere and changed nothing', async () => {
    const loop = call('projects__getAll');
    const chat = new ScriptedChat([loop, loop, loop, call('diary__getOne', '{"id":1}'), said('Achei.')]);
    const record = await runDecidedEpisode(inputFor(chat, new FakeDecisionModel({ projetos: 0.9, diario: 0.1 })));
    expect(record).toMatchObject({ stopped: 'answered', finalText: 'Achei.' });
    expect(record.decision?.fallback).toBe('unanswered');
    expect(record.steps).toHaveLength(5);
    expect(toolNames(chat, 3)).toHaveLength(3);
  });

  it('starts again when the model reached for a tool outside the chosen subject', async () => {
    const chat = new ScriptedChat([
      call('diary__getOne', '{"id":1}'),
      said('Não consegui.'),
      said('Feito pelo completo.'),
    ]);
    const record = await runDecidedEpisode(inputFor(chat, new FakeDecisionModel({ projetos: 0.9, diario: 0.1 })));
    expect(record.decision?.fallback).toBe('out-of-scope');
    expect(record.finalText).toBe('Feito pelo completo.');
  });

  it('does not start again once the restricted attempt changed the library: it would be done twice', async () => {
    const loop = call('projects__getAll');
    const chat = new ScriptedChat([call('projects__delete', '{"id":1}'), loop, loop]);
    const record = await runDecidedEpisode(inputFor(chat, new FakeDecisionModel({ projetos: 0.9, diario: 0.1 })));
    expect(record.stopped).toBe('max-steps');
    expect(record.decision?.fallback).toBe('none');
    expect(chat.asked).toHaveLength(3);
  });
});

describe('changedLibrary', () => {
  const record = (name: string, ok: boolean) =>
    ({
      steps: [
        {
          reply: reply({}),
          calls: [
            {
              id: 'c',
              name,
              arguments: '{}',
              wallMs: 1,
              result: ok ? { ok: true, result: 1 } : { ok: false, error: { code: 'X', type: 't', message: 'm' } },
            },
          ],
        },
      ],
    }) as unknown as Parameters<typeof changedLibrary>[0];

  it('is true only for a call that asks for approval and went through', () => {
    expect(changedLibrary(record('articles__updateStatus', true))).toBe(true);
    expect(changedLibrary(record('articles__updateStatus', false))).toBe(false);
    expect(changedLibrary(record('articles__getByProject', true))).toBe(false);
  });
});

describe('decidedConfig', () => {
  it('has the d1-2B, two subjects and no confidence fallback by default', () => {
    expect(decidedConfig({})).toMatchObject({ model: { id: 'd1-2b' }, topAreas: 2, minConfidence: 0, port: 8090 });
  });

  it('reads the flags', () => {
    expect(decidedConfig({ 'decision-model': 'kev-4b', 'top-areas': '3', 'min-confidence': '0.6' })).toMatchObject({
      model: { id: 'kev-4b' },
      topAreas: 3,
      minConfidence: 0.6,
    });
  });

  it.each([
    [{ 'decision-model': 'jev' }, /ERR_UNKNOWN_MODEL.*"jev".*Expected one of: d1-2b, kev-4b/s],
    [{ 'top-areas': '0' }, /ERR_BAD_FLAG.*"0" for --top-areas.*whole number of 1 or more/s],
    [{ 'top-areas': '1.5' }, /ERR_BAD_FLAG.*"1.5" for --top-areas/s],
    [{ 'min-confidence': 'alto' }, /ERR_BAD_FLAG.*"alto" for --min-confidence/s],
  ])('refuses %j, with the value and what it expected', (args, message) => {
    expect(() => decidedConfig(args)).toThrow(message);
  });
});
