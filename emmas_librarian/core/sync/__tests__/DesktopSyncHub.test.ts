import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ChangeLog } from '../ChangeLog';
import { DesktopSyncHub } from '../DesktopSyncHub';
import { OperationBuilder } from '../OperationBuilder';
import { PendingChangeStore } from '../PendingChangeStore';
import { RowExporter } from '../RowExporter';
import { SyncDeviceRegistry, type StoredSyncDevice, type SyncDeviceStore } from '../SyncDeviceRegistry';
import { installSyncSchema } from '../syncSchema';
import type { SyncRequest } from '../syncProtocol';
import { WebCryptoProvider } from '../crypto/WebCryptoProvider';
import { answerPairingOffer } from '../crypto/pairing';
import { SecureChannel, deriveSessionKey, type SealedMessage } from '../crypto/SecureChannel';
import { fromBase64Url, toBase64Url, utf8 } from '../crypto/bytes';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
const crypto = new WebCryptoProvider(globalThis.crypto);
const EMPTY_ROUND: SyncRequest = { cursor: 0, operations: [], processed: [] };

class MemoryDeviceStore implements SyncDeviceStore {
  private devices: StoredSyncDevice[] = [];
  public read(): StoredSyncDevice[] {
    return this.devices;
  }
  public write(devices: StoredSyncDevice[]): void {
    this.devices = devices;
  }
}

/** A phone that already opened one session: it seals requests and reads the answers like the real client. */
interface PhoneSession {
  sessionId: string;
  channel: SecureChannel;
}

let db: Database.Database;
let hub: DesktopSyncHub;
let registry: SyncDeviceRegistry;
let clock: number;
let deviceId: string;
let deviceKey: Uint8Array;

beforeEach(async () => {
  db = new Database(':memory:');
  db.exec(SCHEMA);
  installSyncSchema(db);
  clock = 1_000_000;
  registry = new SyncDeviceRegistry(new MemoryDeviceStore());
  const log = new ChangeLog(db);
  const exporter = new RowExporter(db, log);
  hub = new DesktopSyncHub({
    crypto,
    registry,
    log,
    builder: new OperationBuilder(log, exporter, 'desktop'),
    store: new PendingChangeStore(db, log, exporter),
    now: () => clock,
  });
  const { answer, device } = await answerPairingOffer(crypto, await hub.createOffer(), 'Pixel of Ana', clock);
  await hub.completePairing(answer);
  deviceId = device.deviceId;
  deviceKey = device.deviceKey;
});

afterEach(() => db.close());

async function openSession(): Promise<PhoneSession> {
  const phoneNonce = crypto.randomBytes(16);
  const reply = await hub.hello(deviceId, toBase64Url(phoneNonce));
  const key = await deriveSessionKey(crypto, deviceKey, phoneNonce, fromBase64Url(reply.desktopNonce));
  return { sessionId: reply.sessionId, channel: new SecureChannel(crypto, key, 'phone', deviceId) };
}

const sealedRound = (session: PhoneSession): Promise<SealedMessage> =>
  session.channel.seal(utf8(JSON.stringify(EMPTY_ROUND)));

describe('DesktopSyncHub after the phone is unpaired (#207 review, M2)', () => {
  it('closes the sessions of that phone', async () => {
    const session = await openSession();
    hub.closeSessionsOf(deviceId);
    await expect(hub.round(session.sessionId, await sealedRound(session))).rejects.toThrow('unknown, expired');
  });

  it('refuses a round on a session opened before the phone was removed from the registry', async () => {
    const session = await openSession();
    const sealed = await sealedRound(session);
    registry.revoke(deviceId);
    await expect(hub.round(session.sessionId, sealed)).rejects.toThrow('of an unpaired phone');
    await expect(hub.hello(deviceId, toBase64Url(crypto.randomBytes(16)))).rejects.toThrow('is not paired');
  });
});
