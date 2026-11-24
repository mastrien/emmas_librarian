import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CommandRegistry } from '../../../../../core/commands/CommandRegistry';
import { RemoteGateway } from '../../../../../core/remote/RemoteGateway';
import { ChangeLog } from '../../../../../core/sync/ChangeLog';
import { DesktopSyncHub } from '../../../../../core/sync/DesktopSyncHub';
import { OperationBuilder } from '../../../../../core/sync/OperationBuilder';
import { PendingChangeStore } from '../../../../../core/sync/PendingChangeStore';
import { RowExporter } from '../../../../../core/sync/RowExporter';
import {
  SyncDeviceRegistry,
  type StoredSyncDevice,
  type SyncDeviceStore,
} from '../../../../../core/sync/SyncDeviceRegistry';
import { installSyncSchema } from '../../../../../core/sync/syncSchema';
import { WebCryptoProvider } from '../../../../../core/sync/crypto/WebCryptoProvider';
import { toBase64Url, utf8 } from '../../../../../core/sync/crypto/bytes';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../../../../core/database/schema.sql'), 'utf8');

class MemoryDeviceStore implements SyncDeviceStore {
  private devices: StoredSyncDevice[] = [];
  public read(): StoredSyncDevice[] {
    return this.devices;
  }
  public write(devices: StoredSyncDevice[]): void {
    this.devices = devices;
  }
}

/**
 * A real desktop sync stack (SQLite from schema.sql, hub, gateway) with no socket: `send` is a `fetch` that goes
 * straight into the gateway, so what a phone does here is exactly what it does over the network.
 *
 * Usage:
 *   const desktop = new DesktopFixture();
 *   const text = await desktop.pairingText();
 */
export class DesktopFixture {
  public readonly db: Database.Database;
  public readonly log: ChangeLog;
  public readonly store: PendingChangeStore;
  public readonly hub: DesktopSyncHub;
  public readonly pdfs = new Map<string, Uint8Array>();
  private readonly gateway: RemoteGateway;

  constructor(public readonly crypto = new WebCryptoProvider(globalThis.crypto)) {
    this.db = new Database(':memory:');
    this.db.exec(SCHEMA);
    installSyncSchema(this.db);
    this.log = new ChangeLog(this.db);
    const exporter = new RowExporter(this.db, this.log);
    this.store = new PendingChangeStore(this.db, this.log, exporter);
    this.hub = new DesktopSyncHub({
      crypto,
      registry: new SyncDeviceRegistry(new MemoryDeviceStore()),
      log: this.log,
      store: this.store,
      builder: new OperationBuilder(this.log, exporter, 'desktop'),
      now: () => Date.now(),
      readPdf: (uuid) => this.pdfs.get(uuid) ?? null,
    });
    this.gateway = new RemoteGateway({
      commands: new CommandRegistry(),
      authenticate: () => null,
      sync: this.hub,
      hideInternalErrors: true,
    });
  }

  public readonly send = (async (url: string | URL | Request, init?: RequestInit) => {
    const response = await this.gateway.handle({
      method: init?.method ?? 'GET',
      path: new URL(String(url)).pathname,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(String(init?.body ?? '')),
      remoteAddress: '192.168.0.50',
    });
    return new Response(String(response.body), { status: response.status });
  }) as typeof fetch;

  /** The text a phone reads from the QR code of "Parear um celular". */
  public async pairingText(): Promise<string> {
    const offer = await this.hub.createOffer();
    const encoded = toBase64Url(
      utf8(JSON.stringify({ ...offer, address: '192.168.0.10', port: 47810, syncPort: 47811 })),
    );
    return `https://192.168.0.10:47810/#sync=${encoded}`;
  }

  public run(sql: string, ...params: (string | number)[]): number {
    return Number(this.db.prepare(sql).run(...params).lastInsertRowid);
  }

  public applyAllPending(): void {
    this.store.apply(this.store.listPending().map((change) => change.operation.opId));
  }

  public close(): void {
    this.db.close();
  }
}
