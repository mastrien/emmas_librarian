import crypto from 'crypto';

/**
 * A random secret for URLs and headers (256 bits, base64url).
 *
 * Usage:
 *   const token = newRemoteSecret();
 */
export function newRemoteSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * What is stored instead of a device token: a leaked devices file does not let anyone in.
 *
 * Usage:
 *   const tokenHash = hashRemoteSecret(token);
 */
export function hashRemoteSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Compares two secrets without telling, by the time it takes, how much of one matches the other.
 *
 * Usage:
 *   if (sameSecret(hashRemoteSecret(given), device.tokenHash)) allow();
 */
export function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
