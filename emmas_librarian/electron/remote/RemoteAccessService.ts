import https from 'https';
import type { AddressInfo } from 'net';
import type { RemoteAccessStatus, RemotePairingInvite } from '../../src/types/remoteAccess';
import type { CommandRegistry } from '../../core/commands/CommandRegistry';
import type { SecretStore } from '../../core/ports/SecretStore';
import { PairedDevices } from '../../core/remote/PairedDevices';
import { PairingDesk } from '../../core/remote/PairingDesk';
import { RemoteGateway } from '../../core/remote/RemoteGateway';
import { gatewayListener } from './gatewayListener';
import { loadTlsIdentity, type CertificateIssuer, type TlsIdentity } from './tlsIdentity';
import type { QrEncoder } from './qrEncoder';

/** Where the choice and the port are remembered: the library's settings. */
export interface RemoteAccessSettings {
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
}

export interface RemoteAccessHost {
  commands: CommandRegistry;
  userData: string;
  secrets: SecretStore;
  settings: RemoteAccessSettings;
  issueCertificate: CertificateIssuer;
  encodeQr: QrEncoder;
  /** IPv4 addresses of this computer on the local network, asked each time (they change with the network). */
  addresses: () => string[];
  /** Interface the server listens on; every interface by default, loopback in tests. */
  bindHost?: string;
}

const ENABLED_KEY = 'remote_access_enabled';
const PORT_KEY = 'remote_access_port';
export const DEFAULT_REMOTE_PORT = 47810;

const LANDING_PAGE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Emma's Librarian</title>
<body style="font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5">
<h1>Emma's Librarian</h1><p>O acesso pelo celular está ligado neste computador.</p>
<p>Para parear, abra Configurações &rsaquo; Acesso pelo celular no aplicativo e leia o código QR.</p></body></html>`;

function listen(server: https.Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve((server.address() as AddressInfo).port));
  });
}

/**
 * The LAN server of the desktop app (#32): off until the person turns it on, HTTPS with a self-signed
 * certificate, one token per paired phone. This class owns its lifecycle; what a phone may do is
 * decided in core/remote.
 *
 * Usage:
 *   const remote = new RemoteAccessService({ commands, userData, secrets, settings: db, ... });
 *   await remote.startIfEnabled();
 *   const invite = await remote.startPairing(); // show invite.qrSvg
 */
export class RemoteAccessService {
  private readonly devices: PairedDevices;
  private readonly desk = new PairingDesk();
  private server: https.Server | null = null;
  private identity: TlsIdentity | null = null;
  private port: number | null = null;
  private error: string | null = null;

  constructor(private readonly host: RemoteAccessHost) {
    this.devices = new PairedDevices(host.userData);
  }

  private isEnabled(): boolean {
    return this.host.settings.getSetting(ENABLED_KEY) === 'true';
  }

  status(): RemoteAccessStatus {
    return {
      enabled: this.isEnabled(),
      running: this.server !== null,
      port: this.port,
      addresses: this.host.addresses(),
      fingerprint: this.identity?.fingerprint ?? null,
      devices: this.devices.list(),
      error: this.error,
    };
  }

  /** Starts the server when the person left it on; a failure is reported in the status, never thrown. */
  async startIfEnabled(): Promise<RemoteAccessStatus> {
    if (this.isEnabled() && !this.server) await this.startSafely();
    return this.status();
  }

  async setEnabled(enabled: boolean): Promise<RemoteAccessStatus> {
    this.host.settings.setSetting(ENABLED_KEY, enabled ? 'true' : 'false');
    if (!enabled) this.stop();
    return this.startIfEnabled();
  }

  private async startSafely(): Promise<void> {
    try {
      await this.start();
      this.error = null;
    } catch (failure) {
      this.stop();
      this.error = failure instanceof Error ? failure.message : String(failure);
      console.error('LAN server failed to start:', failure);
    }
  }

  private async start(): Promise<void> {
    const hosts = [...this.host.addresses(), 'localhost', '127.0.0.1'];
    const { userData, secrets, issueCertificate: issue } = this.host;
    this.identity = await loadTlsIdentity({ userData, secrets, issue, hosts });
    this.port = await this.listenOnSavedPort(this.identity);
    this.host.settings.setSetting(PORT_KEY, String(this.port));
  }

  private gateway(): RemoteGateway {
    return new RemoteGateway({
      commands: this.host.commands,
      authenticate: (token) => {
        const device = this.devices.authenticate(token);
        return device ? { kind: 'device', deviceId: device.id } : null;
      },
      pairing: { desk: this.desk, devices: this.devices },
      hideInternalErrors: true,
    });
  }

  // The port is kept between runs so a paired phone finds the server at the same address. If another
  // program took it, any free port is used (and the phones are paired again).
  private async listenOnSavedPort(identity: TlsIdentity): Promise<number> {
    const saved = Number(this.host.settings.getSetting(PORT_KEY)) || DEFAULT_REMOTE_PORT;
    const bindHost = this.host.bindHost ?? '0.0.0.0';
    for (const port of [saved, 0]) {
      const listener = gatewayListener(this.gateway(), { landingPage: LANDING_PAGE });
      const server = https.createServer({ key: identity.key, cert: identity.cert }, listener);
      try {
        const bound = await listen(server, port, bindHost);
        this.server = server;
        return bound;
      } catch (failure) {
        if ((failure as NodeJS.ErrnoException).code !== 'EADDRINUSE' || port === 0) throw failure;
      }
    }
    throw new Error(`No port available for the LAN server (tried ${saved} and a random one)`);
  }

  /** Opens a one-time pairing code and answers what the desktop shows for the phone to read. */
  async startPairing(): Promise<RemotePairingInvite> {
    const address = this.host.addresses()[0];
    if (!this.server || !this.identity || !this.port || !address) {
      throw new Error(
        `[ERR_REMOTE_NOT_RUNNING] O acesso pelo celular não está ativo ou este computador não está em uma rede. Offending value: running=${this.server !== null}, address=${address ?? 'nenhum'}. Expected shape: servidor ligado e um endereço IPv4 na rede local.`,
      );
    }
    const { code, expiresAt } = this.desk.open();
    // The code travels in the fragment, which browsers never send to the server or write in its logs.
    const url = `https://${address}:${this.port}/#pair=${code}`;
    return { url, expiresAt, fingerprint: this.identity.fingerprint, qrSvg: await this.host.encodeQr(url) };
  }

  cancelPairing(): void {
    this.desk.cancel();
  }

  revokeDevice(id: string): RemoteAccessStatus {
    this.devices.revoke(id);
    return this.status();
  }

  stop(): void {
    this.desk.cancel();
    this.server?.close();
    this.server?.closeAllConnections();
    this.server = null;
    this.port = null;
  }
}
