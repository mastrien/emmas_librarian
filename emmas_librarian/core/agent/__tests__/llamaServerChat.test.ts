// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { LlamaServerChat, type ChatRequest } from '../chatClient';

/** A stand-in for llama-server: answers the chat route with a prepared status and body, and remembers what it got. */
class StandInServer {
  readonly received: Array<{ url: string; body: Record<string, unknown> }> = [];
  private readonly server: http.Server;

  constructor(
    private readonly status: number,
    private readonly answer: unknown,
  ) {
    this.server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        this.received.push({ url: request.url ?? '', body: JSON.parse(Buffer.concat(chunks).toString() || '{}') });
        response.writeHead(this.status, { 'content-type': 'application/json' });
        response.end(typeof this.answer === 'string' ? this.answer : JSON.stringify(this.answer));
      });
    });
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

const request: ChatRequest = {
  messages: [{ role: 'user', content: 'Quais projetos eu tenho?' }],
  tools: [],
  sampling: { temperature: 0.1 },
};

let running: StandInServer | undefined;
afterEach(async () => {
  await running?.stop();
  running = undefined;
});

describe('LlamaServerChat', () => {
  it('posts the request to the chat route and reads the reply, with the timings of the server', async () => {
    running = new StandInServer(200, {
      choices: [{ message: { content: 'Um projeto.' }, finish_reason: 'stop' }],
      timings: { prompt_n: 12, prompt_ms: 30, predicted_n: 4, predicted_ms: 20 },
    });
    const model = new LlamaServerChat(await running.start());
    const reply = await model.complete(request);
    expect(reply).toMatchObject({ content: 'Um projeto.', finishReason: 'stop' });
    expect(reply.timings).toEqual({ promptTokens: 12, promptMs: 30, generatedTokens: 4, generatedMs: 20 });
    expect(running.received[0]).toMatchObject({
      url: '/v1/chat/completions',
      body: { temperature: 0.1, messages: [{ role: 'user', content: 'Quais projetos eu tenho?' }] },
    });
  });

  it('fails with the status and the start of the body when the server does not answer 200', async () => {
    running = new StandInServer(503, 'Loading model');
    const model = new LlamaServerChat(await running.start());
    await expect(model.complete(request)).rejects.toThrow(/ERR_MODEL_HTTP.*503.*Loading model/);
  });
});
