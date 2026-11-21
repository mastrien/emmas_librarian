// The plain-HTTP sync listener and the pairing offer, on a real loopback socket.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CommandRegistry } from '../../../../core/commands/CommandRegistry';
import { DatabaseAdapter } from '../../../../core/database/DatabaseAdapter';
import { FakeSecretStore } from '../../../../core/ports/__tests__/fakes/FakeSecretStore';
import { WebCryptoProvider } from '../../../../core/sync/crypto/WebCryptoProvider';
import { LocalLibrary } from '../../../../mobile/src/local/LocalLibrary';
import { HttpSyncTransport } from '../../../../mobile/src/sync/HttpSyncTransport';
import { PhoneSyncClient } from '../../../../mobile/src/sync/PhoneSyncClient';
import {
  baseUrlOf,
  identityOf,
  pairPhone,
  parseScannedOffer,
  type IdentityStorage,
  type PairedDesktop,
} from '../../../../mobile/src/sync/phonePairing';
import { RemoteAccessService } from '../RemoteAccessService';
import { FakeCertificateIssuer } from './fakes/FakeCertificateIssuer';
import { FakeSettings } from './fakes/FakeSettings';

const crypto = new WebCryptoProvider(globalThis.crypto);

class MemoryIdentity implements IdentityStorage {
  public saved: PairedDesktop | null = null;
  public async loadIdentity() {
    return this.saved;
  }
  public async saveIdentity(desktop: PairedDesktop) {
    this.saved = desktop;
  }
}

let dir: string;
let db: DatabaseAdapter;
let service: RemoteAccessService;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-syncsvc-'));
  db = new DatabaseAdapter(':memory:');
  service = new RemoteAccessService({
    commands: new CommandRegistry(),
    userData: dir,
    secrets: new FakeSecretStore(),
    settings: new FakeSettings(),
    issueCertificate: new FakeCertificateIssuer().issue,
    encodeQr: async (text) => `<svg>${text}</svg>`,
    addresses: () => ['127.0.0.1'],
    bindHost: '127.0.0.1',
    syncParts: () => db.librarySync.parts(),
  });
  await service.setEnabled(true);
});

afterEach(() => {
  service.stop();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('phone sync over the plain listener', () => {
  it('offers a QR whose code names the plain sync port', async () => {
    const invite = await service.startSyncPairing();
    const offer = parseScannedOffer(invite.url);
    expect(offer.syncPort).toBeGreaterThan(0);
    expect(invite.qrSvg).toContain(invite.url);
    expect(baseUrlOf(offer)).toBe(`http://127.0.0.1:${offer.syncPort}`);
  });

  it('pairs a phone, shows it in the status, and syncs a project over real HTTP', async () => {
    db.createProject('From the computer');
    const identityStore = new MemoryIdentity();
    const offer = parseScannedOffer((await service.startSyncPairing()).url);

    const desktop = await pairPhone(crypto, offer, 'Pixel of Ana', identityStore);
    const library = LocalLibrary.empty(desktop.deviceId, { now: () => 't', newUuid: () => String(Math.random()) });
    await new PhoneSyncClient(crypto, identityOf(desktop), library, new HttpSyncTransport(desktop.baseUrl)).sync();

    expect(service.status().syncDevice).toMatchObject({
      deviceName: 'Pixel of Ana',
      verificationCode: desktop.verificationCode,
    });
    expect(library.rows('projects')).toMatchObject([{ name: 'From the computer' }]);
  });

  it('sends the PDF of an article, byte for byte, when the phone asks for it', async () => {
    const project = db.createProject('P');
    const article = db.saveArticle(project.id, { title: 'A', source_query: '', source_databases: '', csl_json: '{}' });
    const file = path.join(dir, 'a.pdf');
    fs.writeFileSync(file, Buffer.from('%PDF-1.4 conteúdo'));
    db.updateArticleFilePath(article, file);
    const offer = parseScannedOffer((await service.startSyncPairing()).url);
    const desktop = await pairPhone(crypto, offer, 'Pixel', new MemoryIdentity());
    const library = LocalLibrary.empty(desktop.deviceId, { now: () => 't', newUuid: () => String(Math.random()) });
    const client = new PhoneSyncClient(crypto, identityOf(desktop), library, new HttpSyncTransport(desktop.baseUrl));
    await client.sync();

    const bytes = await client.fetchPdf(library.rows('articles')[0].uuid);

    expect(Buffer.from(bytes ?? []).toString()).toBe('%PDF-1.4 conteúdo');
  });

  it('lists, applies and rejects what the phone changed, through the service the settings screen calls', async () => {
    const project = db.createProject('Review');
    const uuid = db.librarySync.parts().log.uuidOf('projects', project.id);
    const op = (opId: string, name: string) => ({
      opId,
      deviceId: 'd',
      entity: 'projects',
      uuid,
      kind: 'update',
      fields: { name },
      changedAt: 't',
    });
    db.librarySync.parts().store.stage([op('a', 'Renamed'), op('b', 'Other')]);

    expect(service.listPhoneChanges().map((change) => change.opId)).toEqual(['a', 'b']);
    expect(service.applyPhoneChanges(['a'])).toEqual([{ opId: 'a', status: 'applied', reason: null }]);
    expect(service.rejectPhoneChanges(['b'])).toEqual([{ opId: 'b', status: 'rejected', reason: null }]);
    expect(db.getAllProjects()[0].name).toBe('Renamed');
  });

  it('serves nothing but sync on that port: no commands, no pages', async () => {
    const { syncPort } = parseScannedOffer((await service.startSyncPairing()).url);
    const commands = await fetch(`http://127.0.0.1:${syncPort}/api/commands`, {
      headers: { Authorization: 'Bearer anything' },
    });
    const page = await fetch(`http://127.0.0.1:${syncPort}/`);
    expect([commands.status, page.status]).toEqual([401, 404]);
  });

  it('stops listening when the server is turned off', async () => {
    const { syncPort } = parseScannedOffer((await service.startSyncPairing()).url);
    await service.setEnabled(false);
    await expect(fetch(`http://127.0.0.1:${syncPort}/api/ping`)).rejects.toThrow();
  });

  it('forgets the phone when revoked, and its session stops working', async () => {
    const offer = parseScannedOffer((await service.startSyncPairing()).url);
    const desktop = await pairPhone(crypto, offer, 'Pixel', new MemoryIdentity());
    service.revokeSyncDevice();
    const library = LocalLibrary.empty(desktop.deviceId, { now: () => 't', newUuid: () => 'u' });
    const client = new PhoneSyncClient(crypto, identityOf(desktop), library, new HttpSyncTransport(desktop.baseUrl));
    await expect(client.sync()).rejects.toThrow('is not paired');
  });
});
