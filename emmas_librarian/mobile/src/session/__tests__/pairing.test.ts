import { describe, it, expect } from 'vitest';
import {
  browserTokenStore,
  deviceNameFrom,
  isServedByDesktop,
  PairingError,
  pairingCodeFrom,
  pairWithDesktop,
} from '../pairing';
import { fetchTransport, DesktopError } from '../../reader/HttpProjectReader';
import { FakeDesktopServer } from './fakes/FakeDesktopServer';

describe('pairingCodeFrom', () => {
  it.each([
    ['#pair=abc-123_X', 'abc-123_X'],
    ['#pair=', null],
    ['#/projects', null],
    ['', null],
  ])('reads %j as %j', (hash, code) => {
    expect(pairingCodeFrom(hash)).toBe(code);
  });
});

describe('deviceNameFrom', () => {
  it.each([
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604.1',
      'iPhone (Safari)',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
      'Android (Chrome)',
    ],
    ['Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit/605 CriOS/120.0 Mobile/15E148 Safari/604.1', 'iPad (Chrome)'],
    ['Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0', 'Android (Firefox)'],
    ['curl/8.0', 'Navegador'],
  ])('names %j as %s', (userAgent, name) => {
    expect(deviceNameFrom(userAgent)).toBe(name);
  });
});

describe('pairWithDesktop', () => {
  it('trades the code for the token, sending the device name as JSON', async () => {
    const desktop = new FakeDesktopServer();

    expect(await pairWithDesktop('codigo', 'iPhone (Safari)', desktop.send)).toBe('token-do-celular');
    expect(desktop.requests[0]).toMatchObject({
      route: '/api/pair',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'codigo', deviceName: 'iPhone (Safari)' },
    });
  });

  it('explains a code that was used or expired', async () => {
    const failure = pairWithDesktop('errado', 'x', new FakeDesktopServer().send);

    await expect(failure).rejects.toBeInstanceOf(PairingError);
    await expect(failure).rejects.toThrow('O código já foi usado ou venceu. Abra um novo código no computador');
  });

  it('explains too many attempts', async () => {
    const desktop = new FakeDesktopServer();
    desktop.pairStatus = 429;

    await expect(pairWithDesktop('codigo', 'x', desktop.send)).rejects.toThrow('Muitas tentativas; espere um minuto.');
  });
});

describe('isServedByDesktop', () => {
  it('is true where the ping answers as the app', async () => {
    expect(await isServedByDesktop(new FakeDesktopServer().send)).toBe(true);
  });

  it('is false on the copy published on the web, and with no network', async () => {
    const web = new FakeDesktopServer();
    web.present = false;

    expect(await isServedByDesktop(web.send)).toBe(false);
    expect(await isServedByDesktop(async () => Promise.reject(new TypeError('Failed to fetch')))).toBe(false);
  });
});

describe('browserTokenStore', () => {
  it('keeps, reads back and forgets the token', () => {
    const tokens = browserTokenStore(window.localStorage);

    tokens.write('abc');
    expect(tokens.read()).toBe('abc');
    tokens.clear();
    expect(tokens.read()).toBeNull();
  });

  it('forgets quietly in a browser that refuses storage (a private window)', () => {
    const refuse = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    const tokens = browserTokenStore({ getItem: refuse, setItem: refuse, removeItem: refuse });

    expect(() => tokens.write('abc')).not.toThrow();
    expect(tokens.read()).toBeNull();
    expect(() => tokens.clear()).not.toThrow();
  });
});

describe('fetchTransport', () => {
  it('posts the arguments with the device token and answers the result', async () => {
    const desktop = new FakeDesktopServer();
    desktop.results['diary:getAll'] = [{ id: 1 }];

    expect(await fetchTransport(desktop.token, desktop.send).run('diary:getAll', [3])).toEqual([{ id: 1 }]);
    expect(desktop.requests[0]).toMatchObject({
      route: '/api/commands/diary%3AgetAll',
      method: 'POST',
      headers: { Authorization: 'Bearer token-do-celular', 'Content-Type': 'application/json' },
      body: { args: [3] },
    });
  });

  it('answers the bytes of a file', async () => {
    const desktop = new FakeDesktopServer();
    desktop.bytes['pdf:get'] = new Uint8Array([37, 80, 68, 70]);

    const bytes = await fetchTransport(desktop.token, desktop.send).runForBytes('pdf:get', [5]);

    // Compared as plain numbers: the test DOM hands back a Uint8Array of another realm.
    expect(Array.from(bytes)).toEqual([37, 80, 68, 70]);
  });

  it("fails with the desktop's code, message and status", async () => {
    const failure = await fetchTransport('revogado', new FakeDesktopServer().send)
      .run('projects:getAll')
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DesktopError);
    expect(failure).toMatchObject({
      code: 'ERR_REMOTE_UNAUTHORIZED',
      status: 401,
      message: 'Token ausente, inválido ou revogado',
    });
  });

  it('tells the app when the desktop no longer accepts the token, and only then', async () => {
    const desktop = new FakeDesktopServer();
    desktop.results['projects:getAll'] = [];
    let refused = 0;
    const count = () => {
      refused += 1;
    };

    await fetchTransport(desktop.token, desktop.send, count).run('projects:getAll');
    await fetchTransport(desktop.token, desktop.send, count)
      .run('nope')
      .catch(() => undefined);
    expect(refused).toBe(0);

    await fetchTransport('revogado', desktop.send, count)
      .run('projects:getAll')
      .catch(() => undefined);
    expect(refused).toBe(1);
  });

  it('still fails clearly when the answer is not JSON', async () => {
    const broken: typeof fetch = async () => new Response('<html>502</html>', { status: 502 });

    await expect(fetchTransport('t', broken).run('projects:getAll')).rejects.toMatchObject({
      code: 'ERR_INTERNAL',
      message: 'O computador respondeu 502.',
    });
  });
});
