// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IpcChannel } from '../../../src/types';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { PairedDevices } from '../PairedDevices';
import { PairingDesk } from '../PairingDesk';
import { RemoteGateway, type GatewayRequest, type GatewayResponse } from '../RemoteGateway';

let workDir: string;
let clock: number;
let commands: CommandRegistry;
let devices: PairedDevices;
let desk: PairingDesk;
let gateway: RemoteGateway;
let ran: string[];

const request = (
  method: string,
  route: string,
  body?: unknown,
  extra: Partial<GatewayRequest> = {},
): GatewayRequest => ({
  method,
  path: route,
  headers: { 'content-type': 'application/json' },
  body: Buffer.from(body === undefined ? '' : JSON.stringify(body)),
  remoteAddress: '192.168.0.20',
  ...extra,
});
const withToken = (token: string, extra: Record<string, string> = {}) => ({
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...extra },
});
const parsed = (response: GatewayResponse) => JSON.parse(String(response.body));
const command = (token: string, name: string, args?: unknown[]) =>
  gateway.handle(request('POST', `/api/commands/${name}`, args ? { args } : undefined, withToken(token)));

async function pairPhone(name = 'Celular da Ana'): Promise<string> {
  const { code } = desk.open();
  const response = await gateway.handle(request('POST', '/api/pair', { code, deviceName: name }));
  return parsed(response).result.token as string;
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-gateway-'));
  clock = Date.parse('2026-11-14T10:00:00.000Z');
  ran = [];
  commands = new CommandRegistry();
  commands.add(IpcChannel.PROJECTS_GET_ALL, () => [{ id: 1, name: 'Tese' }]);
  commands.add(IpcChannel.DIARY_SAVE, (...args: unknown[]) => void ran.push(`diary(${args.join(', ')})`));
  commands.add(IpcChannel.SETTINGS_GET, () => 'sk-segredo');
  commands.add(IpcChannel.PDF_GET, () => Buffer.from('%PDF-1.4'));
  commands.add(IpcChannel.ARTICLES_GET_ONE, (id: number) => {
    if (id === 404) throw new Error('[ERR_NOT_FOUND] Artigo não encontrado. Offending value: id=404');
    throw new Error('EACCES: permission denied, open /home/ana/segredo.db');
  });
  devices = new PairedDevices(path.join(workDir, 'userData'));
  desk = new PairingDesk(() => clock);
  gateway = new RemoteGateway({
    commands,
    authenticate: (token) => {
      const device = devices.authenticate(token);
      return device ? { kind: 'device', deviceId: device.id } : null;
    },
    pairing: { desk, devices },
    hideInternalErrors: true,
    now: () => clock,
  });
});

afterEach(() => fs.rmSync(workDir, { recursive: true, force: true }));

describe('RemoteGateway: ping and unknown routes', () => {
  it('answers a ping without a token, saying only which app this is', async () => {
    const response = await gateway.handle(request('GET', '/api/ping'));

    expect(response.status).toBe(200);
    expect(parsed(response)).toEqual({ ok: true, result: { app: 'emmas-librarian' } });
  });

  it.each([
    ['GET', '/'],
    ['GET', '/api/commands/projects:getAll'],
    ['PUT', '/api/commands'],
    ['DELETE', '/api/pair'],
  ])('answers 404 for %s %s', async (method, route) => {
    const response = await gateway.handle(request(method, route));

    expect(response.status).toBe(404);
    expect(parsed(response).error.code).toBe('ERR_REMOTE_NOT_FOUND');
  });
});

describe('RemoteGateway: pairing', () => {
  it('trades the open code for a device token, once', async () => {
    const { code } = desk.open();

    const first = await gateway.handle(request('POST', '/api/pair', { code, deviceName: 'Celular da Ana' }));
    const second = await gateway.handle(request('POST', '/api/pair', { code, deviceName: 'Outro' }));

    expect(first.status).toBe(200);
    expect(parsed(first).result).toMatchObject({ deviceName: 'Celular da Ana', token: expect.any(String) });
    expect(second.status).toBe(403);
    expect(parsed(second).error.code).toBe('ERR_PAIRING_REFUSED');
    expect(devices.list().map((device) => device.name)).toEqual(['Celular da Ana']);
  });

  it('refuses a wrong code and a pairing nobody opened', async () => {
    expect((await gateway.handle(request('POST', '/api/pair', { code: 'x' }))).status).toBe(403);
    desk.open();
    expect((await gateway.handle(request('POST', '/api/pair', { code: 'errado' }))).status).toBe(403);
    expect(devices.list()).toEqual([]);
  });

  it('pairs nobody on a gateway without pairing (the local channel)', async () => {
    const localOnly = new RemoteGateway({ commands, authenticate: () => null });

    expect((await localOnly.handle(request('POST', '/api/pair', { code: 'x' }))).status).toBe(403);
  });
});

describe('RemoteGateway: commands', () => {
  it('runs an allowed command for a paired device and answers its result', async () => {
    const token = await pairPhone();

    const response = await command(token, IpcChannel.PROJECTS_GET_ALL);

    expect(response).toMatchObject({ status: 200, contentType: 'application/json; charset=utf-8' });
    expect(parsed(response)).toEqual({ ok: true, result: [{ id: 1, name: 'Tese' }] });
  });

  it('passes the arguments of the body and answers null for a command that answers nothing', async () => {
    const token = await pairPhone();

    const response = await command(token, IpcChannel.DIARY_SAVE, [3, '2026-11-14', 'li dois artigos']);

    expect(parsed(response)).toEqual({ ok: true, result: null });
    expect(ran).toEqual(['diary(3, 2026-11-14, li dois artigos)']);
  });

  it('answers the bytes of a PDF as they are', async () => {
    const token = await pairPhone();

    const response = await command(token, IpcChannel.PDF_GET, [1]);

    expect(response.contentType).toBe('application/octet-stream');
    expect(response.body).toEqual(Buffer.from('%PDF-1.4'));
  });

  it.each([
    ['no token', {}],
    ['a token nobody was given', { authorization: 'Bearer inventado' }],
    ['another scheme', { authorization: 'Basic abc' }],
  ])('answers 401 with %s and runs nothing', async (_label, headers) => {
    const response = await gateway.handle(
      request(
        'POST',
        `/api/commands/${IpcChannel.DIARY_SAVE}`,
        { args: [1] },
        {
          headers: { 'content-type': 'application/json', ...headers },
        },
      ),
    );

    expect(response.status).toBe(401);
    expect(parsed(response).error.code).toBe('ERR_REMOTE_UNAUTHORIZED');
    expect(ran).toEqual([]);
  });

  it('stops answering a device as soon as it is revoked', async () => {
    const token = await pairPhone();
    devices.revoke(devices.list()[0].id);

    expect((await command(token, IpcChannel.PROJECTS_GET_ALL)).status).toBe(401);
  });

  it('answers 403 for a command off the device list: the API keys never leave the desktop', async () => {
    const token = await pairPhone();

    const response = await command(token, IpcChannel.SETTINGS_GET, ['api_key_openai']);

    expect(response.status).toBe(403);
    expect(String(response.body)).not.toContain('sk-segredo');
  });

  it('answers 404 for a command that does not exist', async () => {
    expect((await command(await pairPhone(), 'nope')).status).toBe(404);
  });

  it('answers 400 with the message when the command rejects its input', async () => {
    const response = await command(await pairPhone(), IpcChannel.ARTICLES_GET_ONE, [404]);

    expect(response.status).toBe(400);
    expect(parsed(response).error).toMatchObject({ code: 'ERR_NOT_FOUND' });
    expect(parsed(response).error.message).toContain('id=404');
  });

  it('answers 500 without the internal message, which may name files of this computer', async () => {
    const response = await command(await pairPhone(), IpcChannel.ARTICLES_GET_ONE, [1]);

    expect(response.status).toBe(500);
    expect(String(response.body)).not.toContain('/home/ana');
  });

  it.each([
    ['text/plain', '{"args":[]}', 'Content-Type inválido'],
    ['application/json', '{not json', 'não é JSON válido'],
    ['application/json', '{"args":"x"}', '"args" inválido'],
  ])('answers 400 for a %s body %s', async (contentType, body, problem) => {
    const token = await pairPhone();

    const response = await gateway.handle({
      ...request('POST', `/api/commands/${IpcChannel.PROJECTS_GET_ALL}`),
      headers: { 'content-type': contentType, authorization: `Bearer ${token}` },
      body: Buffer.from(body),
    });

    expect(response.status).toBe(400);
    expect(parsed(response).error.message).toContain(problem);
  });
});

describe('RemoteGateway: what a caller may run', () => {
  it('lists a device only the commands on its list', async () => {
    const response = await gateway.handle(request('GET', '/api/commands', undefined, withToken(await pairPhone())));

    const names = (parsed(response).result as { name: string }[]).map((listed) => listed.name);
    const allowed = [
      IpcChannel.ARTICLES_GET_ONE,
      IpcChannel.DIARY_SAVE,
      IpcChannel.PDF_GET,
      IpcChannel.PROJECTS_GET_ALL,
    ];
    expect(names.sort()).toEqual(allowed.sort());
    expect(names).not.toContain(IpcChannel.SETTINGS_GET);
  });

  it('asks for a token before listing anything', async () => {
    expect((await gateway.handle(request('GET', '/api/commands'))).status).toBe(401);
  });
});

describe('RemoteGateway: the local channel (the CLI on this computer)', () => {
  const local = () =>
    new RemoteGateway({ commands, authenticate: (token) => (token === 'local' ? { kind: 'local' } : null) });
  const run = (name: string, args: unknown[] = []) =>
    local().handle(request('POST', `/api/commands/${name}`, { args }, withToken('local')));

  it('runs what a terminal can run, settings included, and shows internal failures in full', async () => {
    expect(parsed(await run(IpcChannel.SETTINGS_GET, ['theme'])).result).toBe('sk-segredo');
    expect(parsed(await run(IpcChannel.ARTICLES_GET_ONE, [1])).error.message).toContain('/home/ana/segredo.db');
  });

  it('refuses desktop-only commands like the CLI itself does', async () => {
    const response = await run(IpcChannel.PDF_GET, [1]);

    expect(response.status).toBe(400);
    expect(parsed(response).error.code).toBe('ERR_GUI_ONLY');
  });

  it('lists the terminal commands', async () => {
    const response = await local().handle(request('GET', '/api/commands', undefined, withToken('local')));

    const names = (parsed(response).result as { name: string }[]).map((listed) => listed.name);
    expect(names).toContain(IpcChannel.SETTINGS_GET);
    expect(names).not.toContain(IpcChannel.PDF_GET);
  });
});

describe('RemoteGateway: throttling of wrong tokens and codes', () => {
  const wrongToken = () => command('inventado', IpcChannel.PROJECTS_GET_ALL);

  it('makes an address wait after ten failures in a minute, even with a valid token', async () => {
    const token = await pairPhone();
    for (let attempt = 0; attempt < 10; attempt += 1) await wrongToken();

    expect((await wrongToken()).status).toBe(429);
    expect((await command(token, IpcChannel.PROJECTS_GET_ALL)).status).toBe(429);
  });

  it('lets the address back in after the minute, and never held other addresses', async () => {
    const token = await pairPhone();
    for (let attempt = 0; attempt < 10; attempt += 1) await wrongToken();
    const elsewhere = { ...withToken(token), remoteAddress: '192.168.0.99' };

    expect(
      (await gateway.handle(request('POST', `/api/commands/${IpcChannel.PROJECTS_GET_ALL}`, {}, elsewhere))).status,
    ).toBe(200);
    clock += 61_000;
    expect((await command(token, IpcChannel.PROJECTS_GET_ALL)).status).toBe(200);
  });

  it('counts wrong pairing codes too', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) await gateway.handle(request('POST', '/api/pair', { code: 'x' }));
    const { code } = desk.open();

    expect((await gateway.handle(request('POST', '/api/pair', { code }))).status).toBe(429);
  });
});
