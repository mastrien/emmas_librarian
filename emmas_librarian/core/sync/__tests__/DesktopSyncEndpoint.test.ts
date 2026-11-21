import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ChangeLog } from '../ChangeLog';
import { DesktopSyncEndpoint } from '../DesktopSyncEndpoint';
import { OperationBuilder } from '../OperationBuilder';
import { PendingChangeStore } from '../PendingChangeStore';
import { RowExporter } from '../RowExporter';
import { installSyncSchema } from '../syncSchema';
import { WebCryptoProvider } from '../crypto/WebCryptoProvider';
import { SecureChannel, deriveSessionKey } from '../crypto/SecureChannel';
import { utf8 } from '../crypto/bytes';
import type { SyncRequest, SyncResponse } from '../syncProtocol';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
const crypto = new WebCryptoProvider(globalThis.crypto);

let db: Database.Database;
let log: ChangeLog;
let store: PendingChangeStore;
let endpoint: DesktopSyncEndpoint;
let phoneChannel: SecureChannel;

beforeEach(async () => {
  db = new Database(':memory:');
  db.exec(SCHEMA);
  installSyncSchema(db);
  log = new ChangeLog(db);
  const exporter = new RowExporter(db, log);
  store = new PendingChangeStore(db, log, exporter);
  const key = await deriveSessionKey(crypto, crypto.randomBytes(32), crypto.randomBytes(16), crypto.randomBytes(16));
  phoneChannel = new SecureChannel(crypto, key, 'phone', 'phone-1');
  const desktopChannel = new SecureChannel(crypto, key, 'desktop', 'phone-1');
  endpoint = new DesktopSyncEndpoint(
    desktopChannel,
    log,
    new OperationBuilder(log, exporter, 'desktop'),
    store,
    'phone-1',
  );
});

afterEach(() => db.close());

/** Plays the phone: seals a request, sends it through the endpoint and opens the reply. */
async function roundTrip(request: SyncRequest): Promise<SyncResponse> {
  const reply = await endpoint.handleSealed(await phoneChannel.seal(utf8(JSON.stringify(request))));
  return JSON.parse(new TextDecoder().decode(await phoneChannel.unseal(reply))) as SyncResponse;
}

const addProject = (name: string): number =>
  Number(db.prepare('INSERT INTO projects (name) VALUES (?)').run(name).lastInsertRowid);
const phoneOp = (opId: string, uuid: string, name: string): unknown => ({
  opId,
  deviceId: 'phone-1',
  entity: 'projects',
  uuid,
  kind: 'insert',
  fields: { name },
  changedAt: '2026-11-21T09:00:00Z',
});

describe('DesktopSyncEndpoint', () => {
  it('sends the phone what changed on the computer and the cursor to ask from next time', async () => {
    addProject('On the desktop');
    const first = await roundTrip({ cursor: 0, operations: [], processed: [] });
    expect(first.operations).toMatchObject([
      { kind: 'insert', entity: 'projects', fields: { name: 'On the desktop' } },
    ]);
    const second = await roundTrip({ cursor: first.cursor, operations: [], processed: [] });
    expect(second.operations).toEqual([]);
  });

  it('stages what the phone sent without applying it', async () => {
    const response = await roundTrip({ cursor: 0, operations: [phoneOp('op-1', 'u-1', 'From phone')], processed: [] });
    expect(response.staged).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n).toBe(0);
    expect(store.listPending()).toHaveLength(1);
  });

  it('counts a retried operation as already staged', async () => {
    const request = { cursor: 0, operations: [phoneOp('op-1', 'u-1', 'x')], processed: [] };
    await roundTrip(request);
    expect((await roundTrip(request)).staged).toBe(0);
  });

  it('tells the phone what the user decided, then stops repeating it once the phone confirms', async () => {
    await roundTrip({ cursor: 0, operations: [phoneOp('op-1', 'u-1', 'x')], processed: [] });
    store.reject(['op-1']);

    const told = await roundTrip({ cursor: 0, operations: [], processed: [] });
    expect(told.decided).toEqual([{ opId: 'op-1', status: 'rejected', reason: null }]);

    const after = await roundTrip({ cursor: 0, operations: [], processed: ['op-1'] });
    expect(after.decided).toEqual([]);
  });

  it('does not echo back to the phone a change that the user just applied from it', async () => {
    await roundTrip({ cursor: 0, operations: [phoneOp('op-1', 'u-1', 'From phone')], processed: [] });
    const mark = log.latestSeq();
    store.apply(['op-1']);
    expect((await roundTrip({ cursor: mark, operations: [], processed: [] })).operations).toEqual([]);
  });

  it('refuses a malformed request, naming the field', async () => {
    const bad = await phoneChannel.seal(utf8(JSON.stringify({ cursor: -1, operations: [], processed: [] })));
    await expect(endpoint.handleSealed(bad)).rejects.toThrow('"cursor" must be a non-negative integer, got -1');
  });

  it('refuses a message that was not sealed with this session key', async () => {
    const stranger = new SecureChannel(crypto, crypto.randomBytes(32), 'phone', 'phone-1');
    const forged = await stranger.seal(utf8(JSON.stringify({ cursor: 0, operations: [], processed: [] })));
    await expect(endpoint.handleSealed(forged)).rejects.toThrow('failed authentication');
  });
});
