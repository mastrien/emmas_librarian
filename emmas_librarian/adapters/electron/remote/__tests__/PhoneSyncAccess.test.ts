// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FakeSecretStore } from '../../../../core/ports/__tests__/fakes/FakeSecretStore';
import { DatabaseAdapter } from '../../../../core/database/DatabaseAdapter';
import { WebCryptoProvider } from '../../../../core/sync/crypto/WebCryptoProvider';
import { answerPairingOffer, type PairedDevice, type PairingOffer } from '../../../../core/sync/crypto/pairing';
import { SecureChannel, deriveSessionKey } from '../../../../core/sync/crypto/SecureChannel';
import { fromBase64Url, toBase64Url, utf8 } from '../../../../core/sync/crypto/bytes';
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

async function pairPhone(): Promise<PairedDevice> {
  const { url } = await access.offerUrl('192.168.0.10', 47810);
  const offer = JSON.parse(new TextDecoder().decode(fromBase64Url(url.split('#sync=')[1]))) as PairingOffer;
  const { answer, device } = await answerPairingOffer(crypto, offer, 'Pixel of Ana', Date.now());
  await access.routes()?.completePairing(answer);
  return device;
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

describe('a session open when the phone is unpaired (#207 review, M2)', () => {
  it('is refused afterwards: the revoke ends it, a new hello is refused too', async () => {
    const device = await pairPhone();
    const phoneNonce = crypto.randomBytes(16);
    const reply = await access.routes()!.hello(device.deviceId, toBase64Url(phoneNonce));
    const key = await deriveSessionKey(crypto, device.deviceKey, phoneNonce, fromBase64Url(reply.desktopNonce));
    const sealed = await new SecureChannel(crypto, key, 'phone', device.deviceId).seal(
      utf8(JSON.stringify({ cursor: 0, operations: [], processed: [] })),
    );

    access.revoke();

    await expect(access.routes()!.round(reply.sessionId, sealed)).rejects.toThrow('unknown, expired');
    await expect(access.routes()!.hello(device.deviceId, toBase64Url(phoneNonce))).rejects.toThrow('is not paired');
  });
});

describe('review of what the phone changed', () => {
  // Changes are only ever staged by a paired phone, so an offer is open before there is anything to review.
  beforeEach(async () => {
    await access.offerUrl('192.168.0.10', 47810);
  });

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
