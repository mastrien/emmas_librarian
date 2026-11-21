// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FakeSecretStore } from '../../../../core/ports/__tests__/fakes/FakeSecretStore';
import { FileSyncDeviceStore } from '../FileSyncDeviceStore';
import type { StoredSyncDevice } from '../../../../core/sync/SyncDeviceRegistry';

let dir: string;
let secrets: FakeSecretStore;
let store: FileSyncDeviceStore;

const device: StoredSyncDevice = { deviceId: 'd1', deviceName: 'Pixel', deviceKey: 'c2VjcmV0LWtleQ', pairedAt: 1 };
const fileText = (): string => fs.readFileSync(path.join(dir, 'sync-device.json'), 'utf8');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-syncdev-'));
  secrets = new FakeSecretStore();
  store = new FileSyncDeviceStore(dir, secrets);
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('FileSyncDeviceStore', () => {
  it('has no device before one is written', () => {
    expect(store.read()).toEqual([]);
  });

  it('gives back what was written', () => {
    store.write([device]);
    expect(store.read()).toEqual([device]);
  });

  it('does not leave the key readable in the file when the system can encrypt', () => {
    store.write([device]);
    expect(fileText()).not.toContain(device.deviceKey);
  });

  it('writes the key as it is, and still reads it, on a machine without a keychain', () => {
    secrets.available = false;
    store.write([device]);
    expect(fileText()).toContain(device.deviceKey);
    expect(store.read()).toEqual([device]);
  });

  it('counts a key the keychain can no longer open as no phone paired', () => {
    store.write([device]);
    secrets.failDecrypt = true;
    expect(store.read()).toEqual([]);
  });

  it('counts a damaged file as no phone paired', () => {
    fs.writeFileSync(path.join(dir, 'sync-device.json'), '{not json');
    expect(store.read()).toEqual([]);
  });

  it('keeps the file readable only by its owner', () => {
    if (process.platform === 'win32') return;
    store.write([device]);
    expect(fs.statSync(path.join(dir, 'sync-device.json')).mode & 0o777).toBe(0o600);
  });
});
