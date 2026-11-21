// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { RemoteGateway, type GatewayRequest, type GatewayResponse, type SyncRoutes } from '../RemoteGateway';
import type { PairingAnswer } from '../../sync/crypto/pairing';
import type { SealedMessage } from '../../sync/crypto/SecureChannel';

class FakeSyncRoutes implements SyncRoutes {
  public calls: string[] = [];
  public failWith: Error | null = null;

  public async completePairing(answer: PairingAnswer) {
    return this.record(`pair:${answer.deviceName}`, { deviceId: 'dev-1', deviceName: answer.deviceName });
  }
  public async hello(deviceId: string, phoneNonce: string) {
    return this.record(`hello:${deviceId}:${phoneNonce}`, { sessionId: 's-1', desktopNonce: 'n-1' });
  }
  public async round(sessionId: string, message: SealedMessage) {
    return this.record(`round:${sessionId}:${message.counter}`, message);
  }
  private record<T>(call: string, result: T): T {
    this.calls.push(call);
    if (this.failWith) throw this.failWith;
    return result;
  }
}

let routes: FakeSyncRoutes;
let gateway: RemoteGateway;

const post = (route: string, body: unknown, contentType = 'application/json'): GatewayRequest => ({
  method: 'POST',
  path: route,
  headers: { 'content-type': contentType },
  body: Buffer.from(JSON.stringify(body)),
  remoteAddress: '192.168.0.20',
});
const parsed = (response: GatewayResponse) => JSON.parse(String(response.body));

beforeEach(() => {
  routes = new FakeSyncRoutes();
  gateway = new RemoteGateway({
    commands: new CommandRegistry(),
    authenticate: () => null,
    sync: routes,
    hideInternalErrors: true,
  });
});

describe('RemoteGateway: encrypted sync routes', () => {
  it('pairs, opens a session and runs a round, with no bearer token', async () => {
    const pair = await gateway.handle(post('/api/sync/pair', { answer: { deviceName: 'Pixel' } }));
    const hello = await gateway.handle(post('/api/sync/hello', { deviceId: 'dev-1', phoneNonce: 'abc' }));
    const round = await gateway.handle(
      post('/api/sync/round', { sessionId: 's-1', message: { version: 1, counter: 3, ciphertext: 'x' } }),
    );

    expect(parsed(pair).result).toEqual({ deviceId: 'dev-1', deviceName: 'Pixel' });
    expect(parsed(hello).result).toEqual({ sessionId: 's-1', desktopNonce: 'n-1' });
    expect(parsed(round).result.counter).toBe(3);
    expect(routes.calls).toEqual(['pair:Pixel', 'hello:dev-1:abc', 'round:s-1:3']);
  });

  it('answers 404 for a step that does not exist, naming it', async () => {
    const response = await gateway.handle(post('/api/sync/format', {}));
    expect(response.status).toBe(404);
    expect(parsed(response).error.message).toContain('"format"');
  });

  it('answers 403 with the reason when the sync layer refuses', async () => {
    routes.failWith = new Error('Device "x" is not paired with this computer; pair it again.');
    const response = await gateway.handle(post('/api/sync/hello', { deviceId: 'x', phoneNonce: 'n' }));
    expect(response.status).toBe(403);
    expect(parsed(response).error).toMatchObject({ code: 'ERR_SYNC_REFUSED' });
    expect(parsed(response).error.message).toContain('is not paired');
  });

  it('answers 403 when sync is not set up on this computer', async () => {
    const bare = new RemoteGateway({ commands: new CommandRegistry(), authenticate: () => null });
    expect((await bare.handle(post('/api/sync/pair', {}))).status).toBe(403);
  });

  it('refuses a body that is not application/json, like every other route', async () => {
    const response = await gateway.handle(post('/api/sync/hello', {}, 'text/plain'));
    expect(response.status).toBe(400);
    expect(routes.calls).toEqual([]);
  });

  it('makes an address wait after ten refusals in a minute', async () => {
    routes.failWith = new Error('refused');
    for (let i = 0; i < 10; i += 1) await gateway.handle(post('/api/sync/hello', { deviceId: 'x', phoneNonce: 'n' }));
    const response = await gateway.handle(post('/api/sync/hello', { deviceId: 'x', phoneNonce: 'n' }));
    expect(response.status).toBe(429);
  });
});
