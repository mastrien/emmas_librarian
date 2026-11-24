// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CommandRegistry } from '../../../../core/commands/CommandRegistry';
import { RemoteGateway } from '../../../../core/remote/RemoteGateway';
import { ChangeLog } from '../../../../core/sync/ChangeLog';
import { DesktopSyncHub } from '../../../../core/sync/DesktopSyncHub';
import { OperationBuilder } from '../../../../core/sync/OperationBuilder';
import { PendingChangeStore } from '../../../../core/sync/PendingChangeStore';
import { RowExporter } from '../../../../core/sync/RowExporter';
import {
  SyncDeviceRegistry,
  type StoredSyncDevice,
  type SyncDeviceStore,
} from '../../../../core/sync/SyncDeviceRegistry';
import { installSyncSchema } from '../../../../core/sync/syncSchema';
import { WebCryptoProvider } from '../../../../core/sync/crypto/WebCryptoProvider';
import { toBase64Url, utf8 } from '../../../../core/sync/crypto/bytes';
import { LocalLibrary } from '../../local/LocalLibrary';
import { PhoneSyncClient } from '../PhoneSyncClient';
import { HttpSyncTransport, SyncRefusedError } from '../HttpSyncTransport';
import {
  identityOf,
  pairPhone,
  parseScannedOffer,
  baseUrlOf,
  type IdentityStorage,
  type PairedDesktop,
} from '../phonePairing';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../../../core/database/schema.sql'), 'utf8');
const crypto = new WebCryptoProvider(globalThis.crypto);

class MemoryDeviceStore implements SyncDeviceStore {
  private devices: StoredSyncDevice[] = [];
  public read() {
    return this.devices;
  }
  public write(devices: StoredSyncDevice[]) {
    this.devices = devices;
  }
}

class MemoryIdentityStorage implements IdentityStorage {
  public saved: PairedDesktop | null = null;
  public async loadIdentity() {
    return this.saved;
  }
  public async saveIdentity(desktop: PairedDesktop) {
    this.saved = desktop;
  }
}

let db: Database.Database;
let hub: DesktopSyncHub;
let gateway: RemoteGateway;
let storage: MemoryIdentityStorage;

/** A `fetch` that goes straight into the desktop's gateway, so the whole HTTP contract is exercised without a socket. */
const fetchIntoGateway = (async (url: string | URL | Request, init?: RequestInit) => {
  const target = new URL(String(url));
  const response = await gateway.handle({
    method: init?.method ?? 'GET',
    path: target.pathname,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(String(init?.body ?? '')),
    remoteAddress: '192.168.0.50',
  });
  return new Response(String(response.body), { status: response.status });
}) as typeof fetch;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(SCHEMA);
  installSyncSchema(db);
  const log = new ChangeLog(db);
  const exporter = new RowExporter(db, log);
  hub = new DesktopSyncHub({
    crypto,
    registry: new SyncDeviceRegistry(new MemoryDeviceStore()),
    log,
    store: new PendingChangeStore(db, log, exporter),
    builder: new OperationBuilder(log, exporter, 'desktop'),
    now: () => Date.now(),
  });
  gateway = new RemoteGateway({
    commands: new CommandRegistry(),
    authenticate: () => null,
    sync: hub,
    hideInternalErrors: true,
  });
  storage = new MemoryIdentityStorage();
});

afterEach(() => db.close());

async function scannedText(extra: object = {}): Promise<string> {
  const offer = await hub.createOffer();
  return `https://192.168.0.10:47810/#sync=${toBase64Url(utf8(JSON.stringify({ ...offer, address: '192.168.0.10', port: 47810, ...extra })))}`;
}

describe('parseScannedOffer', () => {
  it('reads the offer out of the QR address, or out of the bare code', async () => {
    const text = await scannedText();
    const bare = text.split('#sync=')[1];
    expect(parseScannedOffer(text)).toMatchObject({ address: '192.168.0.10', port: 47810 });
    expect(parseScannedOffer(bare).address).toBe('192.168.0.10');
  });

  it('refuses text that is not an offer, showing the start of it', () => {
    expect(() => parseScannedOffer('https://example.org/?q=1')).toThrow('That is not a pairing code');
    expect(() => parseScannedOffer('')).toThrow('That is not a pairing code');
  });

  it('uses the plain sync port when the offer has one, else the HTTPS port', async () => {
    expect(baseUrlOf(parseScannedOffer(await scannedText({ syncPort: 47811 })))).toBe('http://192.168.0.10:47811');
    expect(baseUrlOf(parseScannedOffer(await scannedText()))).toBe('https://192.168.0.10:47810');
  });
});

describe('pairing over the gateway, then syncing', () => {
  it('pairs, keeps the identity, and the same identity syncs afterwards', async () => {
    const offer = parseScannedOffer(await scannedText({ syncPort: 47811 }));
    const desktop = await pairPhone(crypto, offer, 'Pixel of Ana', storage, fetchIntoGateway);

    expect(storage.saved).toEqual(desktop);
    expect(desktop.verificationCode).toMatch(/^([0-9A-F]{4} · ){3}[0-9A-F]{4}$/);

    db.prepare("INSERT INTO projects (name) VALUES ('From the computer')").run();
    const library = LocalLibrary.empty(desktop.deviceId, {
      now: () => 't',
      newUuid: () => crypto.randomBytes(4).join(''),
    });
    const client = new PhoneSyncClient(
      crypto,
      identityOf(desktop),
      library,
      new HttpSyncTransport(desktop.baseUrl, fetchIntoGateway),
    );
    await client.sync();
    expect(library.rows('projects')).toMatchObject([{ name: 'From the computer' }]);
  });

  it('shows the reason when the code was already used', async () => {
    const offer = parseScannedOffer(await scannedText());
    await pairPhone(crypto, offer, 'First', storage, fetchIntoGateway);
    await expect(pairPhone(crypto, offer, 'Second', storage, fetchIntoGateway)).rejects.toBeInstanceOf(
      SyncRefusedError,
    );
  });

  it('does not keep an identity when pairing failed', async () => {
    const offer = parseScannedOffer(await scannedText());
    await expect(
      pairPhone(
        crypto,
        { ...offer, secret: toBase64Url(crypto.randomBytes(32)) },
        'Intruder',
        storage,
        fetchIntoGateway,
      ),
    ).rejects.toThrow('confirmation does not match');
    expect(storage.saved).toBeNull();
  });
});
