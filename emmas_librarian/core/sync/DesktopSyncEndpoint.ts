import { ChangeLog } from './ChangeLog';
import { OperationBuilder } from './OperationBuilder';
import { PendingChangeStore } from './PendingChangeStore';
import { parseSyncRequest, type SyncRequest, type SyncResponse } from './syncProtocol';
import type { Bytes } from './crypto/CryptoProvider';
import { utf8 } from './crypto/bytes';
import type { SealedMessage, SecureChannel } from './crypto/SecureChannel';

const MAX_CHANGES_PER_ROUND = 500;

/**
 * The computer's side of one sync round trip: unseal the phone's request, stage what the phone changed (it
 * waits for the user's confirmation), answer with what changed here, and seal the answer.
 *
 * Usage:
 *   const endpoint = new DesktopSyncEndpoint(channel, log, builder, store, deviceId);
 *   const reply = await endpoint.handleSealed(messageFromPhone);
 */
export class DesktopSyncEndpoint {
  constructor(
    private readonly channel: SecureChannel,
    private readonly log: ChangeLog,
    private readonly builder: OperationBuilder,
    private readonly store: PendingChangeStore,
    private readonly deviceId: string,
  ) {}

  public async handleSealed(message: SealedMessage): Promise<SealedMessage> {
    const plain = await this.channel.unseal(message);
    const request = parseSyncRequest(JSON.parse(new TextDecoder().decode(plain)));
    const response = this.handle(request);
    return this.channel.seal(utf8(JSON.stringify(response)) as Bytes);
  }

  /** The round trip without the encryption; separate so the logic can be tested on its own. */
  public handle(request: SyncRequest): SyncResponse {
    this.store.acknowledge(request.processed);
    const staged = this.store.stage(request.operations);
    const changes = this.log.readSince(request.cursor, MAX_CHANGES_PER_ROUND);
    const cursor = changes.length > 0 ? changes[changes.length - 1].seq : request.cursor;
    return {
      decided: this.store.decidedFor(this.deviceId),
      operations: this.builder.build(changes),
      cursor,
      staged,
    };
  }
}
