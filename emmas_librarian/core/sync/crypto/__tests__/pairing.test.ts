import { describe, it, expect } from 'vitest';
import { WebCryptoProvider } from '../WebCryptoProvider';
import { acceptPairingAnswer, answerPairingOffer, createPairingOffer } from '../pairing';
import { toBase64Url, toHex } from '../bytes';

const crypto = new WebCryptoProvider(globalThis.crypto);
const NOW = 1_000_000;
const IN_FIVE_MINUTES = NOW + 5 * 60_000;

async function pairOnce(): Promise<{
  desktop: Awaited<ReturnType<typeof acceptPairingAnswer>>;
  phone: Awaited<ReturnType<typeof answerPairingOffer>>['device'];
}> {
  const { offer, pending } = await createPairingOffer(crypto, IN_FIVE_MINUTES);
  const { answer, device: phone } = await answerPairingOffer(crypto, offer, 'Pixel of Ana', NOW);
  return { desktop: await acceptPairingAnswer(crypto, pending, answer, NOW), phone };
}

describe('pairing', () => {
  it('leaves both sides with the same device key, id and verification code', async () => {
    const { desktop, phone } = await pairOnce();
    expect(toHex(desktop.deviceKey)).toBe(toHex(phone.deviceKey));
    expect(desktop.deviceId).toBe(phone.deviceId);
    expect(desktop.verificationCode).toBe(phone.verificationCode);
    expect(desktop.verificationCode).toMatch(/^([0-9A-F]{4} · ){3}[0-9A-F]{4}$/);
  });

  it('gives a different device key every time', async () => {
    const first = await pairOnce();
    const second = await pairOnce();
    expect(toHex(first.desktop.deviceKey)).not.toBe(toHex(second.desktop.deviceKey));
  });

  it('refuses a phone that did not know the QR code secret (someone on the network guessing)', async () => {
    const { offer, pending } = await createPairingOffer(crypto, IN_FIVE_MINUTES);
    const guess = { ...offer, secret: toBase64Url(crypto.randomBytes(32)) };
    const { answer } = await answerPairingOffer(crypto, guess, 'Intruder', NOW);
    await expect(acceptPairingAnswer(crypto, pending, answer, NOW)).rejects.toThrow('confirmation does not match');
  });

  it('refuses an answer whose device name was changed on the way', async () => {
    const { offer, pending } = await createPairingOffer(crypto, IN_FIVE_MINUTES);
    const { answer } = await answerPairingOffer(crypto, offer, 'Pixel of Ana', NOW);
    await expect(acceptPairingAnswer(crypto, pending, { ...answer, deviceName: 'Pixel of Bob' }, NOW)).rejects.toThrow(
      'does not match',
    );
  });

  it('refuses an answer whose public key was swapped for another one', async () => {
    const { offer, pending } = await createPairingOffer(crypto, IN_FIVE_MINUTES);
    const { answer } = await answerPairingOffer(crypto, offer, 'Pixel of Ana', NOW);
    const other = await crypto.generateKeyPair();
    await expect(
      acceptPairingAnswer(crypto, pending, { ...answer, phonePublicKey: toBase64Url(other.publicKey) }, NOW),
    ).rejects.toThrow('does not match');
  });

  it('accepts a pairing only once', async () => {
    const { offer, pending } = await createPairingOffer(crypto, IN_FIVE_MINUTES);
    const { answer } = await answerPairingOffer(crypto, offer, 'Pixel of Ana', NOW);
    await acceptPairingAnswer(crypto, pending, answer, NOW);
    await expect(acceptPairingAnswer(crypto, pending, answer, NOW)).rejects.toThrow('already used');
  });

  it('refuses an expired code on both sides, naming the times', async () => {
    const { offer, pending } = await createPairingOffer(crypto, NOW + 10);
    await expect(answerPairingOffer(crypto, offer, 'Late', NOW + 11)).rejects.toThrow(`expired at ${NOW + 10}`);
    const { answer } = await answerPairingOffer(crypto, offer, 'Late', NOW);
    await expect(acceptPairingAnswer(crypto, pending, answer, NOW + 11)).rejects.toThrow('expired');
  });

  it('refuses an offer of another protocol version, naming both', async () => {
    const { offer } = await createPairingOffer(crypto, IN_FIVE_MINUTES);
    await expect(answerPairingOffer(crypto, { ...offer, version: 2 }, 'x', NOW)).rejects.toThrow(
      'version 2 is not supported; expected 1',
    );
  });
});
