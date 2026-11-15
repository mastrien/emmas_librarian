export interface ToolCallRequest {
  id: string;
  name: string;
  /** What the model wrote, as text: it may not be valid JSON, and the toolkit must see it as it is. */
  arguments: string;
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls: ToolCallRequest[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface ChatTimings {
  promptTokens: number;
  promptMs: number;
  generatedTokens: number;
  generatedMs: number;
}

export interface ChatReply {
  content: string;
  toolCalls: ToolCallRequest[];
  /** Thinking the model wrote, kept for the record and never sent back. */
  reasoning: string;
  finishReason: string;
  timings: ChatTimings;
  wallMs: number;
}

export interface OpenAiTool {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools: OpenAiTool[];
  sampling: Record<string, number>;
}

/** Where a model answers. The evaluation talks to llama-server; the tests to a scripted fake. */
export interface ChatModel {
  complete(request: ChatRequest): Promise<ChatReply>;
}

/** The messages in the shape of the OpenAI chat API, which llama-server speaks. */
export function toWireMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === 'tool') return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    if (message.role !== 'assistant') return message;
    const calls = message.toolCalls.map((c) => ({
      id: c.id,
      type: 'function',
      function: { name: c.name, arguments: c.arguments },
    }));
    return { role: 'assistant', content: message.content, ...(calls.length > 0 ? { tool_calls: calls } : {}) };
  });
}

interface WireChoice {
  message: {
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: Array<{ id?: string; function: { name: string; arguments: string | object } }>;
  };
  finish_reason: string;
}
interface WireReply {
  choices: WireChoice[];
  timings?: { prompt_n?: number; prompt_ms?: number; predicted_n?: number; predicted_ms?: number };
}

/** The reply of llama-server as a ChatReply; arguments that come as an object are written back as JSON text. */
export function fromWireReply(wire: WireReply, wallMs: number): ChatReply {
  const choice = wire.choices[0];
  const calls = (choice.message.tool_calls ?? []).map((call, index) => ({
    id: call.id || `call_${index}`,
    name: call.function.name,
    arguments:
      typeof call.function.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function.arguments),
  }));
  const t = wire.timings ?? {};
  return {
    content: choice.message.content ?? '',
    toolCalls: calls,
    reasoning: choice.message.reasoning_content ?? '',
    finishReason: choice.finish_reason,
    timings: {
      promptTokens: t.prompt_n ?? 0,
      promptMs: t.prompt_ms ?? 0,
      generatedTokens: t.predicted_n ?? 0,
      generatedMs: t.predicted_ms ?? 0,
    },
    wallMs,
  };
}

/**
 * A model served by llama-server on this machine.
 *
 * Usage:
 *   const model = new LlamaServerChat('http://127.0.0.1:8089');
 *   const reply = await model.complete({ messages, tools, sampling: { temperature: 0.1 } });
 */
export class LlamaServerChat implements ChatModel {
  constructor(private readonly baseUrl: string) {}

  async complete(request: ChatRequest): Promise<ChatReply> {
    const started = Date.now();
    const body = JSON.stringify({
      messages: toWireMessages(request.messages),
      tools: request.tools,
      ...request.sampling,
    });
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    if (!response.ok)
      throw new Error(
        `[ERR_MODEL_HTTP] llama-server answered ${response.status}: ${(await response.text()).slice(0, 300)}. Expected 200.`,
      );
    return fromWireReply((await response.json()) as WireReply, Date.now() - started);
  }
}
