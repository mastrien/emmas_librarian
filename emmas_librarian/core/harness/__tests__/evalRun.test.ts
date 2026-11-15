// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import type { ChatModel, ChatReply, ChatRequest } from '../eval/run/chatClient';
import { fromWireReply, toWireMessages } from '../eval/run/chatClient';
import { runEpisode, toOpenAiTools } from '../eval/run/episode';
import { flagsOf } from '../eval/run/flags';
import { MODELS, samplingOf, serverArgs } from '../eval/run/modelCatalog';
import { RunRecorder } from '../eval/run/runRecorder';
import { scoreEpisode } from '../eval/run/score';
import { dayFromText, systemPromptFor } from '../eval/run/systemPrompt';
import { LibraryToolkit } from '../LibraryToolkit';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { FakeConfirmer } from './support/FakeConfirmer';
import type { EvalCase } from '../eval/evalCase';

const reply = (over: Partial<ChatReply>): ChatReply => ({
  content: '',
  toolCalls: [],
  reasoning: '',
  finishReason: 'stop',
  timings: { promptTokens: 10, promptMs: 5, generatedTokens: 4, generatedMs: 8 },
  wallMs: 20,
  ...over,
});

/** Answers with the next reply of a script and remembers what it was asked. */
class ScriptedChat implements ChatModel {
  readonly asked: ChatRequest[] = [];
  constructor(private readonly script: ChatReply[]) {}
  async complete(request: ChatRequest): Promise<ChatReply> {
    this.asked.push({ ...request, messages: [...request.messages] });
    const next = this.script.shift();
    if (!next) throw new Error('[ERR_SCRIPT_ENDED] the scripted model has no more replies');
    return next;
  }
}

const call = (name: string, args: string, id = 'c1') => ({ id, name, arguments: args });
const READ = { confirm: false, localOnly: false };
const ASKS = { confirm: true, localOnly: false };

function toolkitWith(confirm: boolean): LibraryToolkit {
  const commands = new CommandRegistry();
  commands.add('projects:getAll', () => [{ id: 1, name: 'A' }]);
  commands.add('projects:delete', (id: number) => id);
  const number = { type: 'number' as const };
  return new LibraryToolkit({
    commands,
    confirmer: new FakeConfirmer(confirm),
    access: new Map([
      ['projects:getAll', READ],
      ['projects:delete', ASKS],
    ]),
    schemas: [
      { name: 'projects:getAll', parameters: [], source: 't' },
      { name: 'projects:delete', parameters: [{ name: 'id', required: true, schema: number }], source: 't' },
    ],
  });
}

const base = { system: 's', prompt: 'p', sampling: { temperature: 0 }, maxSteps: 4 };

describe('runEpisode', () => {
  it('runs the tools the model asks for, gives the answers back, and stops when the model answers in text', async () => {
    const chat = new ScriptedChat([
      reply({ toolCalls: [call('projects__getAll', '{}')] }),
      reply({ content: 'Você tem o projeto A.' }),
    ]);
    const record = await runEpisode({ ...base, toolkit: toolkitWith(true), chat });

    expect(record.stopped).toBe('answered');
    expect(record.finalText).toBe('Você tem o projeto A.');
    expect(record.steps[0].calls[0].result).toEqual({ ok: true, result: [{ id: 1, name: 'A' }] });
    expect(chat.asked[1].messages.at(-1)).toMatchObject({ role: 'tool', toolCallId: 'c1' });
  });

  it('hands the toolkit text that is not JSON as it is, so the model reads the toolkit refusal', async () => {
    const chat = new ScriptedChat([
      reply({ toolCalls: [call('projects__delete', '{id: 1')] }),
      reply({ content: 'ok' }),
    ]);
    const record = await runEpisode({ ...base, toolkit: toolkitWith(true), chat });

    expect(record.steps[0].calls[0].result).toMatchObject({ ok: false, error: { code: 'ERR_INVALID_ARGUMENTS' } });
  });

  it('stops after the step limit when the model never answers', async () => {
    const forever = Array.from({ length: 4 }, () => reply({ toolCalls: [call('projects__getAll', '{}')] }));
    const record = await runEpisode({ ...base, toolkit: toolkitWith(true), chat: new ScriptedChat(forever) });

    expect(record.stopped).toBe('max-steps');
    expect(record.steps).toHaveLength(4);
  });

  it('records a failure of the model instead of throwing', async () => {
    const record = await runEpisode({ ...base, toolkit: toolkitWith(true), chat: new ScriptedChat([]) });

    expect(record.stopped).toBe('model-error');
    expect(record.error).toContain('ERR_SCRIPT_ENDED');
  });

  it('offers the toolkit tools in the shape of the chat API', () => {
    expect(toOpenAiTools(toolkitWith(true)).map((t) => [t.type, t.function.name])).toEqual([
      ['function', 'projects__getAll'],
      ['function', 'projects__delete'],
    ]);
  });
});

const testCase = (over: Partial<EvalCase['expect']> = {}): EvalCase => ({
  id: 'x',
  kind: 'trap',
  prompt: 'p',
  context: {},
  expect: {
    calls: [
      { tool: 'projects__getAll', input: {} },
      { tool: 'projects__delete', input: null },
    ],
    forbidden: [],
    reply: '',
    errors: [],
    ...over,
  },
  checks: [],
});

describe('scoreEpisode', () => {
  const episode = async (script: ChatReply[], confirm = true) =>
    runEpisode({ ...base, toolkit: toolkitWith(confirm), chat: new ScriptedChat(script) });

  it('passes when the ideal tools were used in order and the state is right', async () => {
    const record = await episode([
      reply({ toolCalls: [call('projects__getAll', '{}')] }),
      reply({ toolCalls: [call('projects__delete', '{"id":1}')] }),
      reply({ content: 'feito' }),
    ]);
    expect(scoreEpisode(testCase(), record, true)).toMatchObject({ pass: true, usedExpectedTools: true, steps: 3 });
  });

  it('accepts another route to the right state for a case that changes the library, but not for one that only reads', async () => {
    const record = await episode([
      reply({ toolCalls: [call('projects__delete', '{"id":1}')] }),
      reply({ content: 'feito' }),
    ]);
    const changing = { ...testCase(), checks: [{ check: 'inTrash' }] };
    expect(scoreEpisode(changing, record, true)).toMatchObject({ usedExpectedTools: false, pass: true });
    expect(scoreEpisode(testCase(), record, true).pass).toBe(false);
  });

  it('fails when the model skipped the listing, and when the state is wrong', async () => {
    const record = await episode([
      reply({ toolCalls: [call('projects__delete', '{"id":1}')] }),
      reply({ content: 'feito' }),
    ]);
    expect(scoreEpisode(testCase(), record, true).usedExpectedTools).toBe(false);
    expect(scoreEpisode(testCase({ calls: [] }), record, false).pass).toBe(false);
  });

  it('counts a forbidden call, a made-up tool, a wrong call and a refusal by the person', async () => {
    const record = await episode(
      [
        reply({
          toolCalls: [
            call('settings__get', '{}', 'a'),
            call('projects__delete', '{"id":"x"}', 'b'),
            call('projects__delete', '{"id":1}', 'c'),
          ],
        }),
        reply({ content: 'não deu' }),
      ],
      false,
    );
    const score = scoreEpisode(testCase({ calls: [], forbidden: ['settings__get'] }), record, true);
    expect(score).toMatchObject({
      violations: ['settings__get'],
      unknownTools: ['settings__get'],
      invalidCalls: 1,
      refusedByPerson: 1,
      pass: false,
    });
  });
});

describe('the wire format', () => {
  it('writes tool calls and results as the chat API wants them', () => {
    const wire = toWireMessages([
      { role: 'assistant', content: '', toolCalls: [call('a__b', '{}')] },
      { role: 'tool', toolCallId: 'c1', content: '{}' },
    ]);
    expect(wire).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'a__b', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'c1', content: '{}' },
    ]);
  });

  it('reads a reply: arguments given as an object become JSON text, timings are kept', () => {
    const parsed = fromWireReply(
      {
        choices: [
          {
            message: {
              content: null,
              reasoning_content: 'pensei',
              tool_calls: [{ function: { name: 'a__b', arguments: { x: 1 } } }],
            },
            finish_reason: 'tool_calls',
          },
        ],
        timings: { prompt_n: 7, prompt_ms: 3, predicted_n: 2, predicted_ms: 4 },
      },
      99,
    );
    expect(parsed).toMatchObject({
      content: '',
      reasoning: 'pensei',
      wallMs: 99,
      timings: { promptTokens: 7, generatedMs: 4 },
    });
    expect(parsed.toolCalls).toEqual([{ id: 'call_0', name: 'a__b', arguments: '{"x":1}' }]);
  });
});

describe('the run setup', () => {
  it('starts every model on the GPU with its chat template, and turns Qwen thinking off', () => {
    const qwen = MODELS.find((m) => m.id === 'qwen3.5-4b')!;
    const args = serverArgs(qwen, 8089);
    expect(args).toEqual(expect.arrayContaining(['--jinja', '-ngl', '99', '--device', 'Vulkan0', '--port', '8089']));
    expect(args[args.indexOf('--chat-template-kwargs') + 1]).toBe('{"enable_thinking":false}');
    expect(serverArgs(MODELS[1], 8089)).not.toContain('--chat-template-kwargs');
  });

  it('sends the sampling of the model card with a fixed seed', () => {
    expect(samplingOf(MODELS[0])).toEqual({ temperature: 0.1, seed: 42, top_k: 50, repeat_penalty: 1.1 });
    expect(samplingOf(MODELS.find((m) => m.id === 'lfm2-1.2b-tool')!)).toEqual({ temperature: 0, seed: 42 });
  });

  it('reads flags, refusing what is not a flag', () => {
    expect(flagsOf(['--model', 'a', '--all'])).toEqual({ model: 'a', all: 'true' });
    expect(() => flagsOf(['model'])).toThrow(/ERR_BAD_FLAG.*"model"/);
  });

  it('gives the date and the project in the system prompt, and reads a day from text', () => {
    expect(systemPromptFor({ today: dayFromText('2026-11-15'), focusProject: { id: 1, name: 'A' } })).toContain(
      'Hoje é domingo, 2026-11-15.',
    );
    expect(() => dayFromText('15/11/2026')).toThrow(/ERR_INVALID_DAY.*15\/11\/2026/);
  });

  it('writes the configuration, the episodes, the summary and an index line of the run', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-runs-'));
    const recorder = new RunRecorder(dir, 'r1');
    recorder.writeConfig({ model: 'm' });
    recorder.writeEpisode('art-2', { ok: true });
    recorder.finish({ passed: 1 });
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'r1', 'config.json'), 'utf-8'))).toEqual({ model: 'm' });
    expect(fs.existsSync(path.join(dir, 'r1', 'episodes', 'art-2.json'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'index.jsonl'), 'utf-8'))).toEqual({ runId: 'r1', passed: 1 });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
