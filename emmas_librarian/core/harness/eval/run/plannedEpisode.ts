import type { RoutedToolkit } from '../../RoutedToolkit';
import type { ChatMessage, ChatModel, ChatReply } from './chatClient';
import { runEpisode, type EpisodeRecord, type EpisodeStep } from './episode';
import { parsePlan, planInstructions, type PlannedTask } from './taskPlan';

export interface PlannedEpisodeInput {
  system: string;
  /** What the planning step knows besides the subjects (today, the project in focus). Not the rules of `system`: it has no tools. */
  planContext: string;
  prompt: string;
  /** The routed library: the plan names the subject of each task, so the subject is opened for the model. */
  toolkit: RoutedToolkit;
  chat: ChatModel;
  sampling: Record<string, number>;
  /** Steps allowed to each task, not to the whole request. */
  maxSteps: number;
  clock?: () => number;
}

type Planned =
  | { kind: 'plan'; tasks: PlannedTask[]; step: EpisodeStep; messages: ChatMessage[] }
  | { kind: 'failed'; record: EpisodeRecord };

const failed = (error: unknown, steps: EpisodeStep[], messages: ChatMessage[]): EpisodeRecord => ({
  steps,
  finalText: '',
  stopped: 'model-error',
  error: String(error),
  messages,
});

/** The plan is a short list: some models reason first (LFM3 used over 500 tokens), so it is a cap against a runaway, not a budget. */
const PLAN_MAX_TOKENS = 2048;

async function planStep(input: PlannedEpisodeInput): Promise<Planned> {
  const messages: ChatMessage[] = [
    { role: 'system', content: [input.planContext, planInstructions(input.toolkit.areaSummaries())].join('\n\n') },
    { role: 'user', content: input.prompt },
  ];
  let reply: ChatReply;
  try {
    reply = await input.chat.complete({
      messages,
      tools: [],
      sampling: { ...input.sampling, max_tokens: PLAN_MAX_TOKENS },
    });
  } catch (error) {
    return { kind: 'failed', record: failed(error, [], messages) };
  }
  messages.push({ role: 'assistant', content: reply.content, toolCalls: [] });
  const step = { reply, calls: [] };
  try {
    const known = input.toolkit.areaSummaries().map((area) => area.id);
    return { kind: 'plan', tasks: parsePlan(reply.content, known), step, messages };
  } catch (error) {
    return { kind: 'failed', record: failed(error, [step], messages) };
  }
}

const taskPrompt = (request: string, task: PlannedTask, done: string[]): string =>
  [
    `Pedido da pessoa: ${request}`,
    `Tarefa de agora (só esta): ${task.task}`,
    done.length > 0 ? `Já feito:\n${done.map((line) => `- ${line}`).join('\n')}` : '',
    'Faça só esta tarefa com as ferramentas e diga em uma frase o que fez ou encontrou.',
  ]
    .filter((part) => part !== '')
    .join('\n');

const closingPrompt = (request: string, done: string[]): string =>
  [
    `Pedido da pessoa: ${request}`,
    done.length > 0
      ? `Resultado das tarefas:\n${done.map((line) => `- ${line}`).join('\n')}`
      : 'Nenhuma tarefa foi feita.',
    'Responda à pessoa, em português e de forma curta.',
  ].join('\n');

async function closingStep(input: PlannedEpisodeInput, done: string[]): Promise<ChatReply | Error> {
  const messages: ChatMessage[] = [
    { role: 'system', content: input.system },
    { role: 'user', content: closingPrompt(input.prompt, done) },
  ];
  try {
    return await input.chat.complete({ messages, tools: [], sampling: input.sampling });
  } catch (error) {
    return new Error(String(error));
  }
}

/**
 * A request in three parts: the model plans (a list of tasks, each with its subject, no tools), does each task alone
 * with the tools of its subject, and then answers the person from what the tasks found. A small model never reads
 * more than one subject's tools, nor more than one task at a time.
 *
 * Usage:
 *   const record = await runPlannedEpisode({ system, prompt, toolkit: new RoutedToolkit(toolkit), chat, sampling, maxSteps: 8 });
 *   record.plan; // the tasks the model wrote
 */
export async function runPlannedEpisode(input: PlannedEpisodeInput): Promise<EpisodeRecord> {
  const planned = await planStep(input);
  if (planned.kind === 'failed') return planned.record;
  const steps: EpisodeStep[] = [planned.step];
  const messages = [...planned.messages];
  const done: string[] = [];
  for (const task of planned.tasks) {
    input.toolkit.openAreas([task.area]);
    const record = await runEpisode({ ...input, prompt: taskPrompt(input.prompt, task, done) });
    steps.push(...record.steps);
    messages.push(...record.messages);
    if (record.stopped !== 'answered') return { ...record, steps, messages, plan: planned.tasks };
    done.push(`${task.task}: ${record.finalText}`);
  }
  const closing = await closingStep(input, done);
  if (closing instanceof Error) return { ...failed(closing, steps, messages), plan: planned.tasks };
  steps.push({ reply: closing, calls: [] });
  return { steps, finalText: closing.content, stopped: 'answered', messages, plan: planned.tasks };
}
