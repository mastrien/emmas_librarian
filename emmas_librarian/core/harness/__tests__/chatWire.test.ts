// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fromWireReply, toWireMessages, wireBody } from '../eval/run/chatClient';

describe('toWireMessages', () => {
  it('writes a tool answer with the id of the call it answers', () => {
    expect(toWireMessages([{ role: 'tool', toolCallId: 'c1', content: '[]' }])).toEqual([
      { role: 'tool', tool_call_id: 'c1', content: '[]' },
    ]);
  });

  it('passes system and user messages as they are', () => {
    const messages = [
      { role: 'system' as const, content: 'regras' },
      { role: 'user' as const, content: 'oi' },
    ];
    expect(toWireMessages(messages)).toEqual(messages);
  });

  it('writes the calls of an assistant message as functions, and leaves tool_calls out when there are none', () => {
    const [withCall, plain] = toWireMessages([
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'projects__getAll', arguments: '{}' }] },
      { role: 'assistant', content: 'Pronto.', toolCalls: [] },
    ]) as Array<Record<string, unknown>>;
    expect(withCall.tool_calls).toEqual([
      { id: 'c1', type: 'function', function: { name: 'projects__getAll', arguments: '{}' } },
    ]);
    expect(plain).not.toHaveProperty('tool_calls');
  });
});

describe('fromWireReply', () => {
  it('keeps the arguments the model wrote as text, and writes an object back as JSON', () => {
    const reply = fromWireReply(
      {
        choices: [
          {
            message: {
              tool_calls: [
                { id: 'a', function: { name: 'x', arguments: '{"id":1' } },
                { function: { name: 'y', arguments: { id: 2 } } },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      },
      5,
    );
    expect(reply.toolCalls).toEqual([
      { id: 'a', name: 'x', arguments: '{"id":1' },
      { id: 'call_1', name: 'y', arguments: '{"id":2}' },
    ]);
  });

  it('takes empty text for a missing content, keeps the reasoning, and zero for timings the server did not send', () => {
    const reply = fromWireReply(
      { choices: [{ message: { content: null, reasoning_content: 'pensei' }, finish_reason: 'stop' }] },
      9,
    );
    expect(reply).toMatchObject({ content: '', reasoning: 'pensei', wallMs: 9 });
    expect(reply.timings).toEqual({ promptTokens: 0, promptMs: 0, generatedTokens: 0, generatedMs: 0 });
  });

  it('has no reasoning when the server sends none', () => {
    const reply = fromWireReply({ choices: [{ message: { content: 'a' }, finish_reason: 'stop' }] }, 1);
    expect(reply.reasoning).toBe('');
  });
});

describe('wireBody', () => {
  it('asks for a tool call only when the request says so, and spreads the sampling', () => {
    const base = { messages: [], tools: [], sampling: { temperature: 0.1, top_k: 50 } };
    expect(wireBody(base)).toEqual({ messages: [], tools: [], temperature: 0.1, top_k: 50 });
    expect(wireBody({ ...base, toolChoice: 'required' })).toMatchObject({ tool_choice: 'required' });
  });
});
