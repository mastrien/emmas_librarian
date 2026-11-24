import { ChangeLog } from './ChangeLog';
import { OperationBuilder } from './OperationBuilder';
import { PendingChangeStore } from './PendingChangeStore';
import {
  parsePdfRequest,
  parseSyncRequest,
  type PdfResponse,
  type SyncRequest,
  type SyncResponse,
} from './syncProtocol';
import type { Bytes } from './crypto/CryptoProvider';
import { toBase64Url, utf8 } from './crypto/bytes';
import type { SealedMessage, SecureChannel } from './crypto/SecureChannel';

const MAX_CHANGES_PER_ROUND = 500;
/** A bigger PDF is refused rather than sealed in one message; the phone shows why. */
export const MAX_PDF_BYTES = 64 * 1024 * 1024;

/** Gives the PDF of an article by uuid, or null when it has none on this computer. */
export type PdfSource = (articleUuid: string) => Uint8Array | null;

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
    private readonly readPdf: PdfSource = () => null,
  ) {}

  public async handleSealed(message: SealedMessage): Promise<SealedMessage> {
    const plain = await this.channel.unseal(message);
    const request = parseSyncRequest(JSON.parse(new TextDecoder().decode(plain)));
    const response = this.handle(request);
    return this.channel.seal(utf8(JSON.stringify(response)) as Bytes);
  }

  /** One article's PDF, sealed. Refuses (naming the size) what is too big for one message. */
  public async handlePdfSealed(message: SealedMessage): Promise<SealedMessage> {
    const plain = await this.channel.unseal(message);
    const request = parsePdfRequest(JSON.parse(new TextDecoder().decode(plain)));
    const bytes = this.readPdf(request.articleUuid);
    if (bytes && bytes.length > MAX_PDF_BYTES) {
      throw new Error(`The PDF has ${bytes.length} bytes; the phone accepts at most ${MAX_PDF_BYTES}.`);
    }
    const response: PdfResponse = { found: bytes !== null, data: bytes ? toBase64Url(bytes) : null };
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
