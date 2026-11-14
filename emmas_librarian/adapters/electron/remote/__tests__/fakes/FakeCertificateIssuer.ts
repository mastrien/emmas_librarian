import { issueSelfSigned, type CertificateIssuer, type IssuedCertificate } from '../../tlsIdentity';

/**
 * Issues real certificates (so TLS and fingerprints work) but only once per test file, since making
 * an RSA key is slow; `issued` records the hosts of every request.
 *
 * Usage:
 *   const issuer = new FakeCertificateIssuer();
 *   await loadTlsIdentity({ userData, secrets, issue: issuer.issue, hosts: ['127.0.0.1'] });
 *   expect(issuer.issued).toHaveLength(1);
 */
export class FakeCertificateIssuer {
  private static cached: Promise<IssuedCertificate> | null = null;
  readonly issued: string[][] = [];

  issue: CertificateIssuer = (hosts) => {
    this.issued.push(hosts);
    FakeCertificateIssuer.cached ??= issueSelfSigned(['127.0.0.1', 'localhost']);
    return FakeCertificateIssuer.cached;
  };
}
