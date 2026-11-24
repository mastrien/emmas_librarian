// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { runPlannedEpisode } from '../eval/run/plannedEpisode';
import { LibraryToolkit } from '../LibraryToolkit';
import { RoutedToolkit } from '../RoutedToolkit';
import type { ToolArea } from '../toolAreas';
import { FakeConfirmer } from './support/FakeConfirmer';
import { ScriptedChat, reply } from './support/ScriptedChat';

const READ = { confirm: false, localOnly: false };
const AREAS: ToolArea[] = [
  { id: 'projetos', about: 'projetos', commands: ['projects:getAll'] },
  { id: 'diario', about: 'diário', commands: ['diary:getAll'] },
];

function routed(): RoutedToolkit {
  const commands = new CommandRegistry();
  commands.add('projects:getAll', () => [{ id: 1, name: 'A' }]);
  commands.add('diary:getAll', () => []);
  const toolkit = new LibraryToolkit({
    commands,
    confirmer: new FakeConfirmer(true),
    access: new Map([
      ['projects:getAll', READ],
      ['diary:getAll', READ],
    ]),
    schemas: [
      { name: 'projects:getAll', parameters: [], source: 't' },
      { name: 'diary:getAll', parameters: [], source: 't' },
    ],
  });
  return new RoutedToolkit(toolkit, AREAS);
}

const planCall = (tarefas: Array<{ assunto: string; tarefa: string }>) =>
  reply({ toolCalls: [{ id: 'p', name: 'submit_plan', arguments: JSON.stringify({ tarefas }) }] });
const PLAN = planCall([{ assunto: 'projetos', tarefa: 'listar os projetos' }]);
const input = (chat: ScriptedChat) => ({
  system: 'sistema com regras de ferramentas',
  planContext: 'contexto do dia',
  prompt: 'Quais projetos eu tenho?',
  toolkit: routed(),
  chat,
  sampling: { temperature: 0 },
  maxSteps: 4,
});

describe('runPlannedEpisode', () => {
  it('plans without tools, does each task with the tools of its subject only, then answers', async () => {
    const chat = new ScriptedChat([
      PLAN,
      reply({ toolCalls: [{ id: 'c1', name: 'projects__getAll', arguments: '{}' }] }),
      reply({ content: 'Há 1 projeto: A.' }),
      reply({ content: 'Você tem o projeto A.' }),
    ]);
    const record = await runPlannedEpisode(input(chat));
    expect(record).toMatchObject({ stopped: 'answered', finalText: 'Você tem o projeto A.' });
    expect(record.plan).toEqual([{ area: 'projetos', task: 'listar os projetos' }]);
    expect(record.steps.flatMap((s) => s.calls.map((c) => c.name))).toEqual(['projects__getAll']);
    expect(chat.asked[0].tools.map((tool) => tool.function.name)).toEqual(['submit_plan']);
    expect(chat.asked[0].toolChoice).toBe('required');
    expect(chat.asked[0].messages[0].content).toContain('- diario: diário');
    expect(chat.asked[0].messages[0].content).toContain('contexto do dia');
    expect(chat.asked[0].messages[0].content).not.toContain('regras de ferramentas');
    expect(chat.asked[0].sampling).toMatchObject({ max_tokens: 2048 });
    const taskTools = chat.asked[1].tools.map((tool) => tool.function.name);
    expect(taskTools).toContain('projects__getAll');
    expect(taskTools).not.toContain('diary__getAll');
    expect(chat.asked[3].tools).toEqual([]);
  });

  it('gives the next task what the earlier ones found', async () => {
    const plan = planCall([
      { assunto: 'projetos', tarefa: 'listar' },
      { assunto: 'diario', tarefa: 'ver o diário' },
    ]);
    const chat = new ScriptedChat([
      plan,
      reply({ content: 'Há o projeto A.' }),
      reply({ content: 'Diário vazio.' }),
      reply({ content: 'Pronto.' }),
    ]);
    await runPlannedEpisode(input(chat));
    expect(JSON.stringify(chat.asked[2].messages[1])).toContain('listar: Há o projeto A.');
    expect(JSON.stringify(chat.asked[3].messages[1])).toContain('ver o diário: Diário vazio.');
  });

  it('answers straight away when the plan is empty', async () => {
    const chat = new ScriptedChat([planCall([]), reply({ content: 'Não tenho acesso a isso.' })]);
    const record = await runPlannedEpisode(input(chat));
    expect(record).toMatchObject({ stopped: 'answered', finalText: 'Não tenho acesso a isso.' });
    expect(record.steps.flatMap((s) => s.calls)).toEqual([]);
    expect(JSON.stringify(chat.asked[1].messages[1])).toContain('Nenhuma tarefa foi feita');
  });

  it('is a model failure, with the text it wrote, when it hands in no plan', async () => {
    const chat = new ScriptedChat([reply({ content: 'vou fazer tudo agora' })]);
    const record = await runPlannedEpisode(input(chat));
    expect(record.stopped).toBe('model-error');
    expect(record.error).toContain('ERR_INVALID_PLAN');
    expect(record.error).toContain('vou fazer tudo agora');
    expect(record.steps).toHaveLength(1);
  });

  it('stops when a task does not finish, keeping the steps so far', async () => {
    const loop = reply({ toolCalls: [{ id: 'c', name: 'projects__getAll', arguments: '{}' }] });
    const chat = new ScriptedChat([PLAN, loop, loop, loop, loop]);
    const record = await runPlannedEpisode(input(chat));
    expect(record.stopped).toBe('max-steps');
    expect(record.steps.length).toBe(5);
    expect(record.plan).toHaveLength(1);
  });

  it('fails with the model error when the planning step fails, before any task', async () => {
    const record = await runPlannedEpisode(input(new ScriptedChat([])));
    expect(record).toMatchObject({ stopped: 'model-error', steps: [] });
    expect(record.error).toContain('ERR_SCRIPT_ENDED');
  });

  it('fails with the plan kept when the closing answer cannot be had after the tasks were done', async () => {
    const chat = new ScriptedChat([PLAN, reply({ content: 'Há 1 projeto: A.' })]);
    const record = await runPlannedEpisode(input(chat));
    expect(record.stopped).toBe('model-error');
    expect(record.plan).toEqual([{ area: 'projetos', task: 'listar os projetos' }]);
    expect(record.error).toContain('ERR_SCRIPT_ENDED');
  });
});
