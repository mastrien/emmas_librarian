import { newRemoteSecret, sameSecret } from './remoteSecrets';

export interface PairingOffer {
  /** One-time code carried by the QR code. */
  code: string;
  expiresAt: string;
}

const TTL_MS = 5 * 60 * 1000;
const MAX_WRONG_ATTEMPTS = 5;

/**
 * Hands out the one-time code a phone presents to be paired. Only one code is open at a time; it
 * works once, for five minutes, and is cancelled after five wrong guesses, so the pairing endpoint
 * cannot be brute-forced while a QR code is on screen.
 *
 * Usage:
 *   const desk = new PairingDesk();
 *   const { code } = desk.open();      // shown as a QR code on the desktop
 *   desk.redeem(codeFromPhone);        // true once, then the code is gone
 */
export class PairingDesk {
  private offer: { code: string; expiresAt: number } | null = null;
  private wrongAttempts = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly newCode: () => string = newRemoteSecret,
  ) {}

  /** Opens a new code, replacing any that was still open. */
  open(): PairingOffer {
    this.offer = { code: this.newCode(), expiresAt: this.now() + TTL_MS };
    this.wrongAttempts = 0;
    return { code: this.offer.code, expiresAt: new Date(this.offer.expiresAt).toISOString() };
  }

  /** Closes the open code, if any (the person left the pairing screen). */
  cancel(): void {
    this.offer = null;
  }

  isOpen(): boolean {
    return this.offer !== null && this.now() < this.offer.expiresAt;
  }

  /** Whether `code` is the open one; a right answer uses it up, too many wrong ones cancel it. */
  redeem(code: unknown): boolean {
    if (!this.isOpen() || !this.offer) return false;
    if (typeof code === 'string' && sameSecret(code, this.offer.code)) {
      this.offer = null;
      return true;
    }
    this.wrongAttempts += 1;
    if (this.wrongAttempts >= MAX_WRONG_ATTEMPTS) this.offer = null;
    return false;
  }
}
