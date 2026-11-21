import type { Bytes, CryptoProvider, EcKeyPair } from './CryptoProvider';
import { concatBytes, equalBytes, fromBase64Url, toBase64Url, toHex, utf8 } from './bytes';

export const PAIRING_VERSION = 1;
const PAIRING_INFO = utf8('emma-sync/pair/v1');
const SECRET_LENGTH = 32;

/** What the computer shows as a QR code. `secret` is what authenticates the phone: it is never sent on the network. */
export interface PairingOffer {
  version: number;
  desktopPublicKey: string;
  secret: string;
  expiresAt: number;
}

/** What the phone sends back. It carries no secret, only a proof that the phone knew the QR code's one. */
export interface PairingAnswer {
  version: number;
  phonePublicKey: string;
  deviceName: string;
  confirmation: string;
}

/** What the computer keeps between showing the QR code and receiving the answer. */
export interface PendingPairing {
  keyPair: EcKeyPair;
  secret: Bytes;
  expiresAt: number;
  used: boolean;
}

/** The result on each side. `deviceKey` is the long-lived secret both ends hold; it never crosses the network. */
export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  deviceKey: Bytes;
  verificationCode: string;
}

interface DerivedKeys {
  deviceKey: Bytes;
  confirmKey: Bytes;
}

async function deriveKeys(crypto: CryptoProvider, shared: Bytes, secret: Bytes): Promise<DerivedKeys> {
  const material = await crypto.hkdf(shared, secret, PAIRING_INFO, 64);
  return { deviceKey: material.slice(0, 32), confirmKey: material.slice(32, 64) };
}

function transcript(desktopPublicKey: Bytes, phonePublicKey: Bytes, deviceName: string): Bytes {
  return concatBytes(utf8('emma-sync/pair/v1'), desktopPublicKey, phonePublicKey, utf8(deviceName));
}

async function describeDevice(crypto: CryptoProvider, deviceKey: Bytes, deviceName: string): Promise<PairedDevice> {
  const id = await crypto.hkdf(deviceKey, new Uint8Array(0), utf8('emma-sync/device-id'), 8);
  const code = await crypto.hkdf(deviceKey, new Uint8Array(0), utf8('emma-sync/verification-code'), 8);
  const hex = toHex(code).toUpperCase();
  return { deviceId: toHex(id), deviceName, deviceKey, verificationCode: hex.match(/.{4}/g)?.join(' · ') ?? hex };
}

function assertOfferUsable(offer: PairingOffer, now: number): void {
  if (offer.version !== PAIRING_VERSION) {
    throw new Error(
      `Pairing version ${offer.version} is not supported; expected ${PAIRING_VERSION}. Update the app that is older.`,
    );
  }
  if (now > offer.expiresAt)
    throw new Error(`The pairing code expired at ${offer.expiresAt} (now ${now}); ask for a new one.`);
}

/**
 * Computer side, step 1: a fresh key pair and a one-time secret, to show as a QR code.
 *
 * @example const { offer, pending } = await createPairingOffer(crypto, Date.now() + 5 * 60_000);
 */
export async function createPairingOffer(
  crypto: CryptoProvider,
  expiresAt: number,
): Promise<{ offer: PairingOffer; pending: PendingPairing }> {
  const keyPair = await crypto.generateKeyPair();
  const secret = crypto.randomBytes(SECRET_LENGTH);
  const offer = {
    version: PAIRING_VERSION,
    desktopPublicKey: toBase64Url(keyPair.publicKey),
    secret: toBase64Url(secret),
    expiresAt,
  };
  return { offer, pending: { keyPair, secret, expiresAt, used: false } };
}

/**
 * Phone side: reads the QR code, derives the device key and builds the answer.
 *
 * @example const { answer, device } = await answerPairingOffer(crypto, scannedOffer, 'Pixel of Ana', Date.now());
 */
export async function answerPairingOffer(
  crypto: CryptoProvider,
  offer: PairingOffer,
  deviceName: string,
  now: number,
): Promise<{ answer: PairingAnswer; device: PairedDevice }> {
  assertOfferUsable(offer, now);
  const desktopPublicKey = fromBase64Url(offer.desktopPublicKey);
  const keyPair = await crypto.generateKeyPair();
  const shared = await crypto.sharedSecret(keyPair, desktopPublicKey);
  const keys = await deriveKeys(crypto, shared, fromBase64Url(offer.secret));
  const tag = await crypto.hmacSha256(keys.confirmKey, transcript(desktopPublicKey, keyPair.publicKey, deviceName));
  const answer = {
    version: PAIRING_VERSION,
    phonePublicKey: toBase64Url(keyPair.publicKey),
    deviceName,
    confirmation: toBase64Url(tag),
  };
  return { answer, device: await describeDevice(crypto, keys.deviceKey, deviceName) };
}

/**
 * Computer side, step 2: checks the phone knew the QR code's secret and was not tampered with on the way. A
 * pairing can be accepted once; after that, or after it expires, it throws.
 *
 * @throws Error when the confirmation does not match, the pairing was used, or it expired
 */
export async function acceptPairingAnswer(
  crypto: CryptoProvider,
  pending: PendingPairing,
  answer: PairingAnswer,
  now: number,
): Promise<PairedDevice> {
  if (pending.used) throw new Error('This pairing code was already used; ask for a new one.');
  if (now > pending.expiresAt)
    throw new Error(`The pairing code expired at ${pending.expiresAt} (now ${now}); ask for a new one.`);
  const phonePublicKey = fromBase64Url(answer.phonePublicKey);
  const shared = await crypto.sharedSecret(pending.keyPair, phonePublicKey);
  const keys = await deriveKeys(crypto, shared, pending.secret);
  const expected = await crypto.hmacSha256(
    keys.confirmKey,
    transcript(pending.keyPair.publicKey, phonePublicKey, answer.deviceName),
  );
  if (!equalBytes(expected, fromBase64Url(answer.confirmation))) {
    throw new Error(
      'The pairing confirmation does not match: the QR code was not the one shown or the answer was altered.',
    );
  }
  pending.used = true;
  return describeDevice(crypto, keys.deviceKey, answer.deviceName);
}
