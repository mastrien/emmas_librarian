import type { ChatModel, ChatReply, ChatRequest } from '../../eval/run/chatClient';

/** A model reply with the fields a test does not care about filled in. */
export const reply = (over: Partial<ChatReply>): ChatReply => ({
  content: '',
  toolCalls: [],
  reasoning: '',
  finishReason: 'stop',
  timings: { promptTokens: 10, promptMs: 5, generatedTokens: 4, generatedMs: 8 },
  wallMs: 20,
  ...over,
});

/** Answers with the next reply of a script and remembers what it was asked. */
export class ScriptedChat implements ChatModel {
  readonly asked: ChatRequest[] = [];
  constructor(private readonly script: ChatReply[]) {}
  async complete(request: ChatRequest): Promise<ChatReply> {
    this.asked.push({ ...request, messages: [...request.messages] });
    const next = this.script.shift();
    if (!next) throw new Error('[ERR_SCRIPT_ENDED] the scripted model has no more replies');
    return next;
  }
}
