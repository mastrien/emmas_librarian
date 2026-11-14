import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { hashRemoteSecret, newRemoteSecret, sameSecret } from './remoteSecrets';

export interface PairedDevice {
  id: string;
  name: string;
  /** SHA-256 of the device's token; the token itself is shown to the device once and never stored. */
  tokenHash: string;
  pairedAt: string;
  lastSeenAt: string | null;
}

/** A device as the settings screen lists it: without anything that would let someone in. */
export type PairedDeviceInfo = Omit<PairedDevice, 'tokenHash'>;

const FILE = 'paired-devices.json';
const MAX_NAME = 60;

const cleanName = (name: unknown): string =>
  (typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '') || 'Dispositivo sem nome';

/**
 * The phones allowed to reach this library over the LAN, kept in `<userData>/paired-devices.json`.
 * Each has its own token, so one can be revoked without touching the others.
 *
 * Usage:
 *   const devices = new PairedDevices(paths.userData);
 *   const { device, token } = devices.add('Celular da Ana');
 *   devices.authenticate(token)?.id === device.id; // true
 */
export class PairedDevices {
  private readonly filePath: string;

  constructor(
    userData: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.filePath = path.join(userData, FILE);
  }

  list(): PairedDeviceInfo[] {
    return this.read().map(({ tokenHash: _hash, ...info }) => info);
  }

  /** Registers a device and answers its token, which exists only in this answer. */
  add(name: unknown): { device: PairedDeviceInfo; token: string } {
    const token = newRemoteSecret();
    const device: PairedDevice = {
      id: crypto.randomUUID(),
      name: cleanName(name),
      tokenHash: hashRemoteSecret(token),
      pairedAt: this.now().toISOString(),
      lastSeenAt: null,
    };
    this.write([...this.read(), device]);
    const { tokenHash: _hash, ...info } = device;
    return { device: info, token };
  }

  /** The device this token belongs to, noting that it was just seen; null for an unknown or revoked token. */
  authenticate(token: string): PairedDeviceInfo | null {
    const given = hashRemoteSecret(token);
    const devices = this.read();
    const found = devices.find((device) => sameSecret(given, device.tokenHash));
    if (!found) return null;
    found.lastSeenAt = this.now().toISOString();
    this.write(devices);
    const { tokenHash: _hash, ...info } = found;
    return info;
  }

  /** Forgets a device; its token stops working at once. Answers whether it was there. */
  revoke(id: string): boolean {
    const devices = this.read();
    const kept = devices.filter((device) => device.id !== id);
    if (kept.length === devices.length) return false;
    this.write(kept);
    return true;
  }

  // A missing or damaged file means "nobody is paired": the safe reading of something we cannot trust.
  private read(): PairedDevice[] {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return Array.isArray(parsed) ? (parsed as PairedDevice[]) : [];
    } catch {
      return [];
    }
  }

  private write(devices: PairedDevice[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    // Owner-only: the file holds hashes, but there is no reason for another account to read it.
    fs.writeFileSync(this.filePath, JSON.stringify(devices, null, 2), { mode: 0o600 });
  }
}
