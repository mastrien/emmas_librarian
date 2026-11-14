import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { generate } from 'selfsigned';
import type { SecretStore } from '../../core/ports/SecretStore';

export interface IssuedCertificate {
  /** PEM. */
  cert: string;
  /** PEM. */
  key: string;
}

/** Creates a certificate valid for these host names and addresses; wraps the library that does it. */
export type CertificateIssuer = (hosts: string[]) => Promise<IssuedCertificate>;

export interface TlsIdentity extends IssuedCertificate {
  /** SHA-256 of the certificate, as browsers show it ("AB:CD:..."). */
  fingerprint: string;
}

const FILE = 'lan-certificate.json';
// Apple devices refuse server certificates valid for longer than 825 days, even ones the person trusted.
const VALID_DAYS = 825;
const RENEW_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

const altName = (host: string) =>
  IPV4.test(host) ? { type: 7 as const, ip: host } : { type: 2 as const, value: host };

/**
 * Self-signed certificate for the LAN server (the `selfsigned` package).
 *
 * Usage:
 *   const { cert, key } = await issueSelfSigned(['192.168.0.10', 'localhost']);
 */
export const issueSelfSigned: CertificateIssuer = async (hosts) => {
  const attributes = [{ name: 'commonName', value: "Emma's Librarian" }];
  const extensions = [{ name: 'subjectAltName' as const, altNames: hosts.map(altName) }];
  const notAfterDate = new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000);
  const issued = await generate(attributes, { keySize: 2048, algorithm: 'sha256', notAfterDate, extensions });
  return { cert: issued.cert, key: issued.private };
};

interface StoredIdentity {
  cert: string;
  key: string;
  /** Whether `key` is base64 of the key encrypted by the OS keychain, instead of the PEM itself. */
  keyEncrypted: boolean;
}

function readStored(file: string, secrets: SecretStore): IssuedCertificate | null {
  try {
    const stored = JSON.parse(fs.readFileSync(file, 'utf8')) as StoredIdentity;
    const key = stored.keyEncrypted ? secrets.decrypt(Buffer.from(stored.key, 'base64')) : stored.key;
    return { cert: stored.cert, key };
  } catch {
    // Missing, damaged, or encrypted by a keychain this user no longer has: a new one is issued.
    return null;
  }
}

function writeStored(file: string, identity: IssuedCertificate, secrets: SecretStore): void {
  const keyEncrypted = secrets.canEncrypt();
  const key = keyEncrypted ? secrets.encrypt(identity.key).toString('base64') : identity.key;
  const stored: StoredIdentity = { cert: identity.cert, key, keyEncrypted };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(stored), { mode: 0o600 });
}

// A stored certificate that does not even parse counts as expired: a new one replaces it.
function stillValid(cert: string, now: number): boolean {
  try {
    return new crypto.X509Certificate(cert).validToDate.getTime() - now > RENEW_BEFORE_MS;
  } catch {
    return false;
  }
}

export interface TlsIdentityHost {
  userData: string;
  secrets: SecretStore;
  issue: CertificateIssuer;
  /** Names and addresses a new certificate is issued for. */
  hosts: string[];
  now?: () => number;
}

/**
 * The certificate the LAN server presents, kept in `<userData>/lan-certificate.json` with its key
 * encrypted by the OS keychain when there is one. It is reused until a month before it expires, even
 * if this computer's address changes: phones recognise the server by this certificate's fingerprint.
 *
 * Usage:
 *   const { cert, key, fingerprint } = await loadTlsIdentity({ userData, secrets, issue: issueSelfSigned, hosts });
 */
export async function loadTlsIdentity(host: TlsIdentityHost): Promise<TlsIdentity> {
  const file = path.join(host.userData, FILE);
  const now = (host.now ?? Date.now)();
  const stored = readStored(file, host.secrets);
  const identity = stored && stillValid(stored.cert, now) ? stored : await host.issue(host.hosts);
  if (identity !== stored) writeStored(file, identity, host.secrets);
  return { ...identity, fingerprint: new crypto.X509Certificate(identity.cert).fingerprint256 };
}
