import type { CryptoProvider } from '../../../core/sync/crypto/CryptoProvider';
import { fromBase64Url, toBase64Url } from '../../../core/sync/crypto/bytes';
import { answerPairingOffer, type PairingOffer } from '../../../core/sync/crypto/pairing';
import { HttpSyncTransport } from './HttpSyncTransport';
import type { PhoneIdentity } from './PhoneSyncClient';

const SYNC_PREFIX = '#sync=';

/** What the QR code of "Parear um celular" carries, once decoded. */
export interface ScannedOffer extends PairingOffer {
  address: string;
  /** The HTTPS port of the desktop's server (the one that serves the web copy of the app). */
  port: number;
  /** The plain-HTTP port that carries only sealed sync messages; the app uses it so no certificate is involved. */
  syncPort?: number;
}

/** What the phone keeps about the computer it paired with, to sync again without scanning. */
export interface PairedDesktop {
  deviceId: string;
  deviceName: string;
  /** The long-lived secret, base64url. Stored on this phone only. */
  deviceKey: string;
  baseUrl: string;
  verificationCode: string;
  pairedAt: number;
}

export interface IdentityStorage {
  loadIdentity(): Promise<PairedDesktop | null>;
  saveIdentity(desktop: PairedDesktop): Promise<void>;
}

/**
 * Reads what the QR code (or its pasted text) says.
 *
 * @example parseScannedOffer('https://192.168.0.10:47810/#sync=eyJ2…') // { address: '192.168.0.10', … }
 * @throws Error with the offending text when it is not a pairing offer
 */
export function parseScannedOffer(text: string): ScannedOffer {
  const encoded = text.includes(SYNC_PREFIX) ? text.slice(text.indexOf(SYNC_PREFIX) + SYNC_PREFIX.length) : text.trim();
  try {
    const offer = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as Partial<ScannedOffer>;
    const valid =
      typeof offer.version === 'number' &&
      typeof offer.desktopPublicKey === 'string' &&
      typeof offer.secret === 'string' &&
      typeof offer.expiresAt === 'number' &&
      typeof offer.address === 'string' &&
      typeof offer.port === 'number';
    if (valid) return offer as ScannedOffer;
  } catch {
    // falls through to the error below
  }
  throw new Error(
    `That is not a pairing code from Emma's Librarian: ${JSON.stringify(text.slice(0, 80))}. Read the QR code of "Parear um celular".`,
  );
}

/** Where to reach the computer: the plain port when it offers one, else the HTTPS port. */
export function baseUrlOf(offer: ScannedOffer): string {
  return offer.syncPort ? `http://${offer.address}:${offer.syncPort}` : `https://${offer.address}:${offer.port}`;
}

/**
 * The phone's side of pairing: answers the offer, sends the answer, and keeps the result.
 *
 * Usage:
 *   const desktop = await pairPhone(crypto, parseScannedOffer(text), 'Pixel of Ana', storage);
 */
export async function pairPhone(
  crypto: CryptoProvider,
  offer: ScannedOffer,
  deviceName: string,
  storage: IdentityStorage,
  send: typeof fetch = (...args) => fetch(...args),
  now: () => number = Date.now,
): Promise<PairedDesktop> {
  const { answer, device } = await answerPairingOffer(crypto, offer, deviceName, now());
  const baseUrl = baseUrlOf(offer);
  await new HttpSyncTransport(baseUrl, send).pair(answer);
  const desktop: PairedDesktop = {
    deviceId: device.deviceId,
    deviceName,
    deviceKey: toBase64Url(device.deviceKey),
    baseUrl,
    verificationCode: device.verificationCode,
    pairedAt: now(),
  };
  await storage.saveIdentity(desktop);
  return desktop;
}

export function identityOf(desktop: PairedDesktop): PhoneIdentity {
  return { deviceId: desktop.deviceId, deviceKey: fromBase64Url(desktop.deviceKey) as PhoneIdentity['deviceKey'] };
}
