import type { DecidedChange } from './PendingChangeStore';
import type { SyncOperation } from './operations';

/** What the phone sends in one round trip, inside a sealed message. */
export interface SyncRequest {
  /** Position in the computer's change log that the phone already has (0 on the first sync). */
  cursor: number;
  /** Changes made on the phone since the last sync; they wait for the user's confirmation on the computer. */
  operations: unknown[];
  /** Decisions the phone has already processed, so the computer stops repeating them. */
  processed: string[];
}

/** What the computer answers. */
export interface SyncResponse {
  /** What the user decided about changes the phone sent: the phone undoes the ones not applied. */
  decided: DecidedChange[];
  /** Changes made on the computer since the phone's cursor. */
  operations: SyncOperation[];
  /** The position the phone should send next time. */
  cursor: number;
  /** How many of the phone's operations were new to the computer (the rest were retries). */
  staged: number;
}

function requireObject(value: unknown): { [key: string]: unknown } {
  if (typeof value === 'object' && value !== null) return value as { [key: string]: unknown };
  throw new Error(`Sync request must be an object, got ${JSON.stringify(value)}`);
}

/**
 * Checks a request that came out of a sealed message. Authentication proves who sent it, not that it is well
 * formed, so the shape is still checked before anything reads it.
 *
 * @throws Error naming the offending field and value
 */
export function parseSyncRequest(raw: unknown): SyncRequest {
  const input = requireObject(raw);
  const { cursor, operations, processed } = input;
  if (typeof cursor !== 'number' || !Number.isSafeInteger(cursor) || cursor < 0) {
    throw new Error(`Sync request "cursor" must be a non-negative integer, got ${JSON.stringify(cursor)}`);
  }
  if (!Array.isArray(operations))
    throw new Error(`Sync request "operations" must be an array, got ${JSON.stringify(operations)}`);
  if (!Array.isArray(processed) || processed.some((id) => typeof id !== 'string')) {
    throw new Error(`Sync request "processed" must be an array of operation ids, got ${JSON.stringify(processed)}`);
  }
  return { cursor, operations, processed: processed as string[] };
}

/** The phone asks for one article's PDF. Sent only when the person chose to keep that PDF on the phone. */
export interface PdfRequest {
  articleUuid: string;
}

/** The answer: the PDF as base64, or `found: false` when the article has no PDF on the computer. */
export interface PdfResponse {
  found: boolean;
  data: string | null;
}

/** @throws Error naming the offending value */
export function parsePdfRequest(raw: unknown): PdfRequest {
  const uuid = (raw as { articleUuid?: unknown } | null)?.articleUuid;
  if (typeof uuid === 'string' && uuid.length > 0) return { articleUuid: uuid };
  throw new Error(`PDF request "articleUuid" must be a non-empty string, got ${JSON.stringify(uuid)}`);
}
