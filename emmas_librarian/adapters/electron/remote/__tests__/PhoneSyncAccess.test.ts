// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FakeSecretStore } from '../../../../core/ports/__tests__/fakes/FakeSecretStore';
import { DatabaseAdapter } from '../../../../core/database/DatabaseAdapter';
import { WebCryptoProvider } from '../../../../core/sync/crypto/WebCryptoProvider';
import { answerPairingOffer, type PairingOffer } from '../../../../core/sync/crypto/pairing';
import { fromBase64Url } from '../../../../core/sync/crypto/bytes';
import { PhoneSyncAccess } from '../PhoneSyncAccess';

let dir: string;
let db: DatabaseAdapter;
let access: PhoneSyncAccess;
const crypto = new WebCryptoProvider(globalThis.crypto);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-phonesync-'));
  db = new DatabaseAdapter(':memory:');
  access = new PhoneSyncAccess({
    userData: dir,
    secrets: new FakeSecretStore(),
    syncParts: () => db.librarySync.parts(),
  });
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function pairPhone(): Promise<void> {
  const { url } = await access.offerUrl('192.168.0.10', 47810);
  const offer = JSON.parse(new TextDecoder().decode(fromBase64Url(url.split('#sync=')[1]))) as PairingOffer;
  const { answer } = await answerPairingOffer(crypto, offer, 'Pixel of Ana', Date.now());
  await access.routes()?.completePairing(answer);
}

describe('PhoneSyncAccess without a library that syncs', () => {
  it('is not available and exposes no routes', () => {
    const bare = new PhoneSyncAccess({ userData: dir, secrets: new FakeSecretStore() });
    expect(bare.available()).toBe(false);
    expect(bare.routes()).toBeUndefined();
  });

  it('refuses to list changes, saying why', () => {
    const bare = new PhoneSyncAccess({ userData: dir, secrets: new FakeSecretStore() });
    expect(() => bare.listPending()).toThrow('Phone sync is not available on this computer');
  });
});

describe('pairing', () => {
  it('shows an address whose fragment carries the offer and where to reach this computer', async () => {
    const { url, expiresAt } = await access.offerUrl('192.168.0.10', 47810);
    const encoded = url.split('#sync=')[1];
    const offer = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    expect(url.startsWith('https://192.168.0.10:47810/#sync=')).toBe(true);
    expect(offer).toMatchObject({ version: 1, address: '192.168.0.10', port: 47810 });
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('knows no phone before pairing, and the phone with its verification code after', async () => {
    expect(access.device()).toBeNull();
    await pairPhone();
    expect(access.device()).toMatchObject({
      deviceName: 'Pixel of Ana',
      verificationCode: expect.stringMatching(/^([0-9A-F]{4} · ){3}[0-9A-F]{4}$/),
    });
  });

  it('forgets the phone when revoked', async () => {
    await pairPhone();
    access.revoke();
    expect(access.device()).toBeNull();
  });
});

describe('review of what the phone changed', () => {
  function stagePhoneRename(): string {
    const project = db.createProject('Review');
    const uuid = db.librarySync.parts().log.uuidOf('projects', project.id);
    db.librarySync.parts().store.stage([
      {
        opId: 'op-1',
        deviceId: 'd',
        entity: 'projects',
        uuid,
        kind: 'update',
        fields: { name: 'Renamed on phone' },
        changedAt: 't',
      },
    ]);
    return uuid;
  }

  it('lists the staged change with the row as it is now', () => {
    stagePhoneRename();
    expect(access.listPending()).toMatchObject([
      { opId: 'op-1', kind: 'update', fields: { name: 'Renamed on phone' }, current: { name: 'Review' } },
    ]);
  });

  it('applies the chosen change and reports it', () => {
    stagePhoneRename();
    expect(access.apply(['op-1'])).toEqual([{ opId: 'op-1', status: 'applied', reason: null }]);
    expect(db.getAllProjects()[0].name).toBe('Renamed on phone');
  });

  it('rejects the chosen change and leaves the project alone', () => {
    stagePhoneRename();
    expect(access.reject(['op-1'])).toEqual([{ opId: 'op-1', status: 'rejected', reason: null }]);
    expect(db.getAllProjects()[0].name).toBe('Review');
  });
});
