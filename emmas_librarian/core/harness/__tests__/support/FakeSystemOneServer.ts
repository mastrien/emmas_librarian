import http from 'http';
import type { AddressInfo } from 'net';

/** A llama-server that only answers /v1/systemone with a prepared body, and remembers what it was sent. */
export class FakeSystemOneServer {
  readonly received: Array<{ path: string; body: unknown }> = [];
  private server?: http.Server;

  constructor(
    private readonly status: number,
    private readonly body: unknown,
  ) {}

  async start(): Promise<string> {
    this.server = http.createServer((request, response) => {
      let text = '';
      request.on('data', (chunk) => (text += chunk));
      request.on('end', () => {
        this.received.push({ path: request.url ?? '', body: JSON.parse(text) });
        response.writeHead(this.status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(this.body));
      });
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server?.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }
}
