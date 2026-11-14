// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PairedDevices } from '../PairedDevices';

let userData: string;
const at = (iso: string) => () => new Date(iso);
const file = () => path.join(userData, 'paired-devices.json');

beforeEach(() => {
  userData = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'emma-devices-')), 'userData');
});

afterEach(() => fs.rmSync(path.dirname(userData), { recursive: true, force: true }));

describe('PairedDevices', () => {
  it('starts with nobody paired', () => {
    expect(new PairedDevices(userData).list()).toEqual([]);
  });

  it('registers a device, lists it without its token and recognises the token', () => {
    const devices = new PairedDevices(userData, at('2026-11-14T10:00:00.000Z'));

    const { device, token } = devices.add('Celular da Ana');

    expect(devices.list()).toEqual([
      { id: device.id, name: 'Celular da Ana', pairedAt: '2026-11-14T10:00:00.000Z', lastSeenAt: null },
    ]);
    expect(devices.authenticate(token)?.id).toBe(device.id);
  });

  it('stores only a hash of the token, in a file another instance reads back', () => {
    const { token } = new PairedDevices(userData).add('Celular');

    expect(fs.readFileSync(file(), 'utf8')).not.toContain(token);
    expect(new PairedDevices(userData).authenticate(token)).not.toBeNull();
  });

  it('notes when a device was last seen', () => {
    const { token } = new PairedDevices(userData).add('Celular');

    new PairedDevices(userData, at('2026-11-15T08:30:00.000Z')).authenticate(token);

    expect(new PairedDevices(userData).list()[0].lastSeenAt).toBe('2026-11-15T08:30:00.000Z');
  });

  it('refuses a token nobody was given', () => {
    const devices = new PairedDevices(userData);
    devices.add('Celular');

    expect(devices.authenticate('outro-token')).toBeNull();
  });

  it('revokes one device and leaves the others working', () => {
    const devices = new PairedDevices(userData);
    const ana = devices.add('Ana');
    const bia = devices.add('Bia');

    expect(devices.revoke(ana.device.id)).toBe(true);

    expect(devices.authenticate(ana.token)).toBeNull();
    expect(devices.authenticate(bia.token)?.name).toBe('Bia');
    expect(devices.revoke(ana.device.id)).toBe(false);
  });

  it.each([
    ['  Celular   da\n Ana ', 'Celular da Ana'],
    ['', 'Dispositivo sem nome'],
    [42, 'Dispositivo sem nome'],
    ['x'.repeat(200), 'x'.repeat(60)],
  ])('cleans the name a device gives itself (%j)', (given, stored) => {
    expect(new PairedDevices(userData).add(given).device.name).toBe(stored);
  });

  it.each(['not json', '{"a":1}'])('treats a damaged file (%s) as nobody paired', (content) => {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(file(), content);

    expect(new PairedDevices(userData).list()).toEqual([]);
  });
});
