// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { FakeConfirmer } from '../../harness/__tests__/support/FakeConfirmer';
import { FakeDecisionModel } from '../../harness/__tests__/support/FakeDecisionModel';
import { ScriptedChat, reply } from '../../harness/__tests__/support/ScriptedChat';
import { askLibrary, type AskDeps } from '../ask';
import type { AgentRuntime } from '../runtime/agentRuntime';

const NOW = new Date(2026, 10, 18);

/** The two models, scripted, and a record of whether the servers were stopped. */
class FakeRuntime {
  stops = 0;
  constructor(
    readonly chat: ScriptedChat,
    readonly decider: FakeDecisionModel,
    readonly device = 'CUDA0',
  ) {}
  asRuntime(): AgentRuntime {
    return { chat: this.chat, decider: this.decider, device: this.device, stop: async () => void this.stops++ };
  }
}

function library(): { commands: CommandRegistry; deleted: number[] } {
  const deleted: number[] = [];
  const commands = new CommandRegistry();
  commands.add('projects:getAll', () => [{ id: 1, name: 'Tese' }]);
  commands.add('projects:delete', (id: number) => void deleted.push(id));
  return { commands, deleted };
}

const call = (name: string, args = '{}') => reply({ toolCalls: [{ id: `c-${name}`, name, arguments: args }] });
const deps = (runtime: FakeRuntime, confirmer = new FakeConfirmer(true)): AskDeps => ({
  startRuntime: async () => runtime.asRuntime(),
  confirmer,
  now: () => NOW,
});
const projectsDecider = () => new FakeDecisionModel({ projetos: 1 });

describe('askLibrary', () => {
  it('answers from the library and lists the calls it made', async () => {
    const { commands } = library();
    const chat = new ScriptedChat([call('projects__getAll'), reply({ content: 'Você tem 1 projeto: Tese.' })]);
    const runtime = new FakeRuntime(chat, projectsDecider());
    const result = await askLibrary('Quais projetos eu tenho?', commands, deps(runtime));

    expect(result).toMatchObject({
      answer: 'Você tem 1 projeto: Tese.',
      calls: [{ tool: 'projects__getAll', arguments: '{}', ok: true }],
      stopped: 'answered',
      fallback: 'none',
      device: 'CUDA0',
    });
    expect(result.subjects[0]).toBe('projetos');
    expect(runtime.stops).toBe(1);
  });

  // Surviving mutation of the review of #202: with modelIsLocal false the tools that send text out stay hidden.
  it('marks the model as local, so the tools that need a local model are offered', async () => {
    const { commands } = library();
    commands.add('ask:indexPlan', () => ({}));
    const chat = new ScriptedChat([reply({ content: 'ok' })]);
    await askLibrary('Quanto falta indexar?', commands, deps(new FakeRuntime(chat, new FakeDecisionModel({ ia: 1 }))));
    const offered = chat.asked[0].tools.map((tool) => tool.function.name);
    expect(offered).toContain('ask__indexPlan');
  });

  it('gives the model today and the local-model rules in the system prompt', async () => {
    const chat = new ScriptedChat([reply({ content: 'ok' })]);
    await askLibrary('oi', library().commands, deps(new FakeRuntime(chat, projectsDecider())));
    const system = chat.asked[0].messages[0];
    expect(system.role).toBe('system');
    expect(system.content).toContain('2026-11-18');
    expect(system.content).toContain('Nenhum projeto em foco');
  });

  // The guard of #199 seen from the command: nothing that changes the library runs without a yes.
  it('does not change the library when the person says no, and says which call was refused', async () => {
    const { commands, deleted } = library();
    const chat = new ScriptedChat([call('projects__delete', '{"id":1}'), reply({ content: 'Nada foi feito.' })]);
    const runtime = new FakeRuntime(chat, projectsDecider());
    const result = await askLibrary('Apague a Tese', commands, deps(runtime, new FakeConfirmer(false)));

    expect(deleted).toEqual([]);
    expect(result.calls).toEqual([
      { tool: 'projects__delete', arguments: '{"id":1}', ok: false, error: 'ERR_NOT_CONFIRMED' },
    ]);
  });

  it('refuses an empty question, naming it, before starting any model', async () => {
    const runtime = new FakeRuntime(new ScriptedChat([]), projectsDecider());
    await expect(askLibrary('   ', library().commands, deps(runtime))).rejects.toMatchObject({
      code: 'ERR_CLI_USAGE',
      message: expect.stringContaining('Pergunta vazia. Offending value: "   "'),
    });
    expect(runtime.stops).toBe(0);
  });

  it('stops the models and reports the failure when the local model fails', async () => {
    const chat = { complete: async () => Promise.reject(new Error('connection refused')) };
    const runtime = new FakeRuntime(chat as unknown as ScriptedChat, projectsDecider());
    await expect(askLibrary('oi', library().commands, deps(runtime))).rejects.toMatchObject({
      code: 'ERR_AGENT_MODEL',
      message: expect.stringContaining('connection refused'),
    });
    expect(runtime.stops).toBe(1);
  });

  it('stops the models even when the question was answered with an error of the toolkit', async () => {
    const chat = new ScriptedChat([call('made__up'), reply({ content: 'não sei' })]);
    const runtime = new FakeRuntime(chat, projectsDecider());
    const result = await askLibrary('x', library().commands, deps(runtime));
    expect(result.calls[0]).toMatchObject({ tool: 'made__up', ok: false });
    expect(runtime.stops).toBe(1);
  });
});
