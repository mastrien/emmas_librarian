import type { Bytes } from './CryptoProvider';

/** Small byte helpers shared by the sync crypto. They run unchanged on the computer (Node) and on the phone. */

export function utf8(text: string): Bytes {
  return new TextEncoder().encode(text);
}

export function concatBytes(...parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function toHex(bytes: Bytes): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Bytes {
  if (!/^([0-9a-f]{2})*$/i.test(hex)) throw new Error(`Expected an even-length hex string, got ${JSON.stringify(hex)}`);
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

/** URL-safe base64 without padding, the form used in QR codes and messages. */
export function toBase64Url(bytes: Bytes): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error(`Expected URL-safe base64, got ${JSON.stringify(text)}`);
  const padded = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** Compares in time that does not depend on where the first difference is, for tags and keys. */
export function equalBytes(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}
