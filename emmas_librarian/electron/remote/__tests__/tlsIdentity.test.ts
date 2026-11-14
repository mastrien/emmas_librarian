// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FakeSecretStore } from '../../../core/ports/__tests__/fakes/FakeSecretStore';
import { issueSelfSigned, loadTlsIdentity } from '../tlsIdentity';
import { FakeCertificateIssuer } from './fakes/FakeCertificateIssuer';

let userData: string;
let secrets: FakeSecretStore;
let issuer: FakeCertificateIssuer;
const DAY = 24 * 60 * 60 * 1000;
const file = () => path.join(userData, 'lan-certificate.json');
const load = (now?: () => number) =>
  loadTlsIdentity({ userData, secrets, issue: issuer.issue, hosts: ['192.168.0.10', 'localhost'], now });

beforeEach(() => {
  userData = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'emma-tls-')), 'userData');
  secrets = new FakeSecretStore();
  issuer = new FakeCertificateIssuer();
});

afterEach(() => fs.rmSync(path.dirname(userData), { recursive: true, force: true }));

describe('issueSelfSigned', () => {
  it('issues a certificate for the given addresses and names, valid for at most 825 days, with its key', async () => {
    const { cert, key } = await issueSelfSigned(['192.168.0.10', 'localhost']);

    const parsed = new crypto.X509Certificate(cert);
    expect(parsed.subjectAltName).toContain('IP Address:192.168.0.10');
    expect(parsed.subjectAltName).toContain('DNS:localhost');
    expect(parsed.validToDate.getTime() - Date.now()).toBeLessThanOrEqual(825 * DAY);
    expect(parsed.validToDate.getTime() - Date.now()).toBeGreaterThan(800 * DAY);
    expect(parsed.checkPrivateKey(crypto.createPrivateKey(key))).toBe(true);
  });
});

describe('loadTlsIdentity', () => {
  it('issues a certificate for the hosts on first use and answers its SHA-256 fingerprint', async () => {
    const identity = await load();

    expect(issuer.issued).toEqual([['192.168.0.10', 'localhost']]);
    expect(identity.fingerprint).toBe(new crypto.X509Certificate(identity.cert).fingerprint256);
    expect(identity.fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });

  it('reuses the stored certificate, so phones keep recognising the server', async () => {
    const first = await load();
    const second = await load();

    expect(second).toEqual(first);
    expect(issuer.issued).toHaveLength(1);
  });

  it('keeps the private key encrypted by the OS keychain on disk', async () => {
    const { key } = await load();

    const stored = JSON.parse(fs.readFileSync(file(), 'utf8'));
    expect(stored.keyEncrypted).toBe(true);
    expect(fs.readFileSync(file(), 'utf8')).not.toContain('PRIVATE KEY');
    expect(secrets.decrypt(Buffer.from(stored.key, 'base64'))).toBe(key);
  });

  it('stores the key as it is where the machine cannot encrypt, and reads it back', async () => {
    secrets.available = false;

    const first = await load();

    expect(JSON.parse(fs.readFileSync(file(), 'utf8'))).toMatchObject({ keyEncrypted: false, key: first.key });
    expect((await load()).key).toBe(first.key);
  });

  it('issues a new certificate a month before the stored one expires', async () => {
    const { cert } = await load();
    const expires = new crypto.X509Certificate(cert).validToDate.getTime();

    await load(() => expires - 31 * DAY);
    expect(issuer.issued).toHaveLength(1);
    await load(() => expires - 29 * DAY);
    expect(issuer.issued).toHaveLength(2);
  });

  it.each(['not json', '{"cert":"x","key":"y","keyEncrypted":false}'])(
    'replaces a stored identity it cannot use (%s)',
    async (content) => {
      fs.mkdirSync(userData, { recursive: true });
      fs.writeFileSync(file(), content);

      const identity = await load();

      expect(identity.cert).toContain('BEGIN CERTIFICATE');
      expect(issuer.issued).toHaveLength(1);
    },
  );

  it('issues again when the keychain no longer opens the stored key', async () => {
    await load();
    secrets.failDecrypt = true;

    await load();

    expect(issuer.issued).toHaveLength(2);
  });
});
