import type { LibraryToolkit, ToolResult } from '../../LibraryToolkit';
import type { ChatMessage, ChatModel, ChatReply, OpenAiTool } from './chatClient';

export interface EpisodeStep {
  reply: ChatReply;
  /** The tools it called and what each answered. */
  calls: Array<{ id: string; name: string; arguments: string; result: ToolResult; wallMs: number }>;
}

export interface EpisodeRecord {
  steps: EpisodeStep[];
  /** What the model said at the end, to the person. */
  finalText: string;
  /** Why it stopped: it answered, it ran out of steps, or the model failed. */
  stopped: 'answered' | 'max-steps' | 'model-error';
  error?: string;
  messages: ChatMessage[];
}

export interface EpisodeInput {
  system: string;
  prompt: string;
  toolkit: LibraryToolkit;
  chat: ChatModel;
  sampling: Record<string, number>;
  maxSteps: number;
  clock?: () => number;
}

/** The toolkit's tools in the shape of the OpenAI chat API. */
export function toOpenAiTools(toolkit: LibraryToolkit): OpenAiTool[] {
  return toolkit.tools().map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
  }));
}

async function runCalls(reply: ChatReply, input: EpisodeInput, now: () => number): Promise<EpisodeStep['calls']> {
  const calls: EpisodeStep['calls'] = [];
  for (const call of reply.toolCalls) {
    const started = now();
    const result = await input.toolkit.call(call.name, parseArguments(call.arguments));
    calls.push({ id: call.id, name: call.name, arguments: call.arguments, result, wallMs: now() - started });
  }
  return calls;
}

// Text that is not JSON goes to the toolkit as it is, so the model reads the toolkit's own refusal.
function parseArguments(text: string): unknown {
  try {
    return text.trim() === '' ? {} : JSON.parse(text);
  } catch {
    return text;
  }
}

const toolMessage = (call: EpisodeStep['calls'][number]): ChatMessage => ({
  role: 'tool',
  toolCallId: call.id,
  content: JSON.stringify(call.result),
});

/**
 * Lets a model work on one request: it calls tools, reads the answers, and stops when it answers in text. The
 * toolkit is the real one, so every refusal, confirmation and error is what a model would meet in use.
 *
 * Usage:
 *   const record = await runEpisode({ system, prompt: 'Quais projetos eu tenho?', toolkit, chat, sampling, maxSteps: 8 });
 */
export async function runEpisode(input: EpisodeInput): Promise<EpisodeRecord> {
  const now = input.clock ?? Date.now;
  const messages: ChatMessage[] = [
    { role: 'system', content: input.system },
    { role: 'user', content: input.prompt },
  ];
  const tools = toOpenAiTools(input.toolkit);
  const steps: EpisodeStep[] = [];
  for (let turn = 0; turn < input.maxSteps; turn++) {
    let reply: ChatReply;
    try {
      reply = await input.chat.complete({ messages, tools, sampling: input.sampling });
    } catch (error) {
      return { steps, finalText: '', stopped: 'model-error', error: String(error), messages };
    }
    messages.push({ role: 'assistant', content: reply.content, toolCalls: reply.toolCalls });
    const calls = await runCalls(reply, input, now);
    steps.push({ reply, calls });
    if (calls.length === 0) return { steps, finalText: reply.content, stopped: 'answered', messages };
    messages.push(...calls.map(toolMessage));
  }
  return { steps, finalText: '', stopped: 'max-steps', messages };
}
