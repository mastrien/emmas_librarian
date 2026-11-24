// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { LibraryToolkit } from '../LibraryToolkit';
import { RoutedToolkit } from '../RoutedToolkit';
import { MODES, runMode, type ModeInput } from '../eval/run/runMode';
import { FakeConfirmer } from './support/FakeConfirmer';
import { FakeDecisionModel } from './support/FakeDecisionModel';
import { ScriptedChat, reply } from './support/ScriptedChat';

const READ = { confirm: false, localOnly: false };

function library(): LibraryToolkit {
  const commands = new CommandRegistry();
  commands.add('projects:getAll', () => [{ id: 1 }]);
  return new LibraryToolkit({
    commands,
    confirmer: new FakeConfirmer(true),
    access: new Map([['projects:getAll', READ]]),
    schemas: [{ name: 'projects:getAll', parameters: [], source: 't' }],
  });
}

const inputFor = (chat: ScriptedChat, over: Partial<ModeInput> = {}): ModeInput => ({
  system: 'sistema',
  planContext: 'contexto',
  prompt: 'Quais projetos eu tenho?',
  chat,
  sampling: { temperature: 0 },
  maxSteps: 3,
  ...over,
});

describe('runMode', () => {
  it('lists the four modes of the comparison', () => {
    expect(MODES).toEqual(['full', 'routed', 'planned', 'decided']);
  });

  it('full offers the toolkit itself, with every tool at once', async () => {
    const toolkit = library();
    const chat = new ScriptedChat([reply({ content: 'Um projeto.' })]);
    const run = await runMode('full', inputFor(chat), toolkit);
    expect(run.offered).toBe(toolkit);
    expect(run.record).toMatchObject({ stopped: 'answered', finalText: 'Um projeto.' });
  });

  it('routed offers a routed view of the toolkit, where the model starts with select_areas only', async () => {
    const chat = new ScriptedChat([reply({ content: 'Nada a fazer.' })]);
    const run = await runMode('routed', inputFor(chat), library());
    expect(run.offered).toBeInstanceOf(RoutedToolkit);
    expect(chat.asked[0].tools.map((tool) => tool.function.name)).toContain('select_areas');
  });

  it('planned asks for a plan first and offers a routed view', async () => {
    const plan = JSON.stringify({ tarefas: [] });
    const chat = new ScriptedChat([
      reply({ toolCalls: [{ id: 'p', name: 'submit_plan', arguments: plan }] }),
      reply({ content: 'Sem tarefas.' }),
    ]);
    const run = await runMode('planned', inputFor(chat), library());
    expect(run.offered).toBeInstanceOf(RoutedToolkit);
    expect(run.record.plan).toEqual([]);
  });

  it('decided refuses to run without a decision model, saying what is missing', async () => {
    const chat = new ScriptedChat([]);
    await expect(runMode('decided', inputFor(chat), library())).rejects.toThrow(/ERR_NO_DECISION_MODEL.*undefined/);
  });

  it('decided offers only the tools of the subject the decision model chose', async () => {
    const chat = new ScriptedChat([reply({ content: 'Um projeto.' })]);
    const decided = { decider: new FakeDecisionModel({ projetos: 0.9 }), topAreas: 1, minConfidence: 0 };
    const run = await runMode('decided', inputFor(chat, { decided }), library());
    expect(run.record.decision?.chosen).toEqual(['projetos']);
    expect(run.offered).toBeInstanceOf(RoutedToolkit);
    expect(run.offered.tools().map((tool) => tool.name)).toContain('projects__getAll');
  });

  it('decided falls back on the whole toolkit when the decision model is not sure enough', async () => {
    const toolkit = library();
    const chat = new ScriptedChat([reply({ content: 'Um projeto.' })]);
    const decided = { decider: new FakeDecisionModel({ projetos: 0.2 }), topAreas: 1, minConfidence: 0.9 };
    const run = await runMode('decided', inputFor(chat, { decided }), toolkit);
    expect(run.offered).toBe(toolkit);
  });
});
