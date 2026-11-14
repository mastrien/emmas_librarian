// The real HTTPS server on loopback, with a real certificate: what a phone would meet on the network.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import net from 'net';
import os from 'os';
import path from 'path';
import { IpcChannel } from '../../types';
import { CommandRegistry } from '../../../core/commands/CommandRegistry';
import { FakeSecretStore } from '../../../core/ports/__tests__/fakes/FakeSecretStore';
import { DEFAULT_REMOTE_PORT, RemoteAccessService } from '../RemoteAccessService';
import { FakeCertificateIssuer } from './fakes/FakeCertificateIssuer';
import { FakeSettings } from './fakes/FakeSettings';

let userData: string;
let settings: FakeSettings;
let commands: CommandRegistry;
let addresses: string[];
let service: RemoteAccessService;
const started: RemoteAccessService[] = [];

const newService = () => {
  const created = new RemoteAccessService({
    commands,
    userData,
    secrets: new FakeSecretStore(),
    settings,
    issueCertificate: new FakeCertificateIssuer().issue,
    encodeQr: async (text) => `<svg>${text}</svg>`,
    addresses: () => addresses,
    bindHost: '127.0.0.1',
  });
  started.push(created);
  return created;
};

interface Reply {
  status: number;
  json: { ok: boolean; result?: unknown; error?: { code: string } };
  text: string;
  certificateFingerprint: string;
}

function call(port: number, method: string, route: string, body?: object, token?: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    // The certificate is self-signed: the test checks it by fingerprint, as the person pairing a phone does.
    const options = { host: '127.0.0.1', port, method, path: route, headers, rejectUnauthorized: false };
    const request = https.request(options, (response) => {
      const certificate = (response.socket as import('tls').TLSSocket).getPeerCertificate();
      let text = '';
      response.on('data', (chunk) => (text += chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode ?? 0,
          text,
          json: text.startsWith('{') ? JSON.parse(text) : { ok: false },
          certificateFingerprint: certificate.fingerprint256,
        }),
      );
    });
    request.on('error', reject);
    request.end(body ? JSON.stringify(body) : '');
  });
}

const codeOf = (url: string) => url.split('#pair=')[1];

beforeEach(() => {
  userData = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'emma-lan-')), 'userData');
  // Port 0: each test gets a free port instead of fighting over the default one.
  settings = new FakeSettings({ remote_access_port: '0' });
  addresses = ['192.168.0.10'];
  commands = new CommandRegistry();
  commands.add(IpcChannel.PROJECTS_GET_ALL, () => [{ id: 1, name: 'Tese' }]);
  commands.add(IpcChannel.SETTINGS_GET, () => 'sk-segredo');
  service = newService();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  started.splice(0).forEach((each) => each.stop());
  vi.restoreAllMocks();
  fs.rmSync(path.dirname(userData), { recursive: true, force: true });
});

describe('RemoteAccessService: off by default', () => {
  it('listens on nothing until the person turns it on', async () => {
    expect(await service.startIfEnabled()).toEqual({
      enabled: false,
      running: false,
      port: null,
      addresses: ['192.168.0.10'],
      fingerprint: null,
      devices: [],
      error: null,
    });
    expect(fs.existsSync(path.join(userData, 'lan-certificate.json'))).toBe(false);
  });

  it('refuses to open a pairing code while off', async () => {
    await expect(service.startPairing()).rejects.toThrow('ERR_REMOTE_NOT_RUNNING');
  });
});

describe('RemoteAccessService: turned on', () => {
  it('serves HTTPS with the certificate whose fingerprint it reports, and remembers the choice and the port', async () => {
    const status = await service.setEnabled(true);

    const ping = await call(status.port!, 'GET', '/api/ping');
    expect(status).toMatchObject({ enabled: true, running: true, error: null });
    expect(ping.json).toEqual({ ok: true, result: { app: 'emmas-librarian' } });
    expect(ping.certificateFingerprint).toBe(status.fingerprint);
    expect(settings.getSetting('remote_access_enabled')).toBe('true');
    expect(settings.getSetting('remote_access_port')).toBe(String(status.port));
  });

  it('shows a page saying what this is to someone who opens the address in a browser', async () => {
    const { port } = await service.setEnabled(true);

    const page = await call(port!, 'GET', '/');

    expect(page.status).toBe(200);
    expect(page.text).toContain('Acesso pelo celular');
  });

  it('pairs a phone with the code of the invite and then answers only what phones may run', async () => {
    const { port } = await service.setEnabled(true);
    const invite = await service.startPairing();

    const paired = await call(port!, 'POST', '/api/pair', { code: codeOf(invite.url), deviceName: 'Celular da Ana' });
    const token = (paired.json.result as { token: string }).token;

    expect((await call(port!, 'POST', `/api/commands/${IpcChannel.PROJECTS_GET_ALL}`, {}, token)).json.result).toEqual([
      { id: 1, name: 'Tese' },
    ]);
    expect(
      (await call(port!, 'POST', `/api/commands/${IpcChannel.SETTINGS_GET}`, { args: ['api_key_openai'] }, token))
        .status,
    ).toBe(403);
    expect(service.status().devices).toMatchObject([{ name: 'Celular da Ana' }]);
  });

  it('makes the invite an https URL of this computer with the code in the fragment, drawn as a QR code', async () => {
    const { port, fingerprint } = await service.setEnabled(true);

    const invite = await service.startPairing();

    expect(invite.url).toMatch(new RegExp(`^https://192\\.168\\.0\\.10:${port}/#pair=[\\w-]{40,}$`));
    expect(invite.qrSvg).toBe(`<svg>${invite.url}</svg>`);
    expect(invite.fingerprint).toBe(fingerprint);
    expect(Date.parse(invite.expiresAt)).toBeGreaterThan(Date.now());
  });

  it('refuses the code after the person closes the pairing screen', async () => {
    const { port } = await service.setEnabled(true);
    const invite = await service.startPairing();
    service.cancelPairing();

    expect((await call(port!, 'POST', '/api/pair', { code: codeOf(invite.url) })).status).toBe(403);
  });

  it('refuses a pairing invite on a computer without a network address', async () => {
    await service.setEnabled(true);
    addresses = [];

    await expect(service.startPairing()).rejects.toThrow('address=nenhum');
  });

  it('stops answering a revoked phone at once', async () => {
    const { port } = await service.setEnabled(true);
    const invite = await service.startPairing();
    const paired = await call(port!, 'POST', '/api/pair', { code: codeOf(invite.url), deviceName: 'Celular' });
    const token = (paired.json.result as { token: string }).token;

    const status = service.revokeDevice(service.status().devices[0].id);

    expect(status.devices).toEqual([]);
    expect((await call(port!, 'POST', `/api/commands/${IpcChannel.PROJECTS_GET_ALL}`, {}, token)).status).toBe(401);
  });

  it('closes the port when turned off, and keeps the paired phones for the next time', async () => {
    const { port } = await service.setEnabled(true);
    const invite = await service.startPairing();
    await call(port!, 'POST', '/api/pair', { code: codeOf(invite.url), deviceName: 'Celular' });

    const off = await service.setEnabled(false);

    expect(off).toMatchObject({ enabled: false, running: false, port: null });
    await expect(call(port!, 'GET', '/api/ping')).rejects.toThrow();
    expect(off.devices).toHaveLength(1);
  });
});

describe('RemoteAccessService: across runs of the app', () => {
  it('starts by itself when it was left on, with the same certificate and the paired phones', async () => {
    const first = await service.setEnabled(true);
    const invite = await service.startPairing();
    const paired = await call(first.port!, 'POST', '/api/pair', { code: codeOf(invite.url), deviceName: 'Celular' });
    const token = (paired.json.result as { token: string }).token;
    service.stop();

    const second = await newService().startIfEnabled();

    expect(second).toMatchObject({ running: true, fingerprint: first.fingerprint });
    expect((await call(second.port!, 'POST', `/api/commands/${IpcChannel.PROJECTS_GET_ALL}`, {}, token)).status).toBe(
      200,
    );
  });

  it('uses the default port when none was saved', () => {
    expect(DEFAULT_REMOTE_PORT).toBe(47810);
  });

  it('moves to a free port when another program took the saved one', async () => {
    const squatter = net.createServer();
    const taken = await new Promise<number>((resolve) =>
      squatter.listen(0, '127.0.0.1', () => resolve((squatter.address() as net.AddressInfo).port)),
    );
    settings.setSetting('remote_access_port', String(taken));

    const status = await service.setEnabled(true);
    squatter.close();

    expect(status.running).toBe(true);
    expect(status.port).not.toBe(taken);
  });

  it('reports a failure to start in the status instead of throwing, and stays off', async () => {
    const broken = new RemoteAccessService({
      commands,
      userData,
      secrets: new FakeSecretStore(),
      settings,
      issueCertificate: async () => {
        throw new Error('sem entropia');
      },
      encodeQr: async () => '',
      addresses: () => addresses,
      bindHost: '127.0.0.1',
    });

    const status = await broken.setEnabled(true);

    expect(status).toMatchObject({ enabled: true, running: false, error: 'sem entropia' });
  });
});

describe('RemoteAccessService: what leaves the desktop', () => {
  it('never puts a device token on disk', async () => {
    const { port } = await service.setEnabled(true);
    const invite = await service.startPairing();
    const paired = await call(port!, 'POST', '/api/pair', { code: codeOf(invite.url), deviceName: 'Celular' });
    const token = (paired.json.result as { token: string }).token;

    const stored = fs.readFileSync(path.join(userData, 'paired-devices.json'), 'utf8');
    expect(stored).not.toContain(token);
    expect(stored).toContain(crypto.createHash('sha256').update(token).digest('hex'));
  });
});
