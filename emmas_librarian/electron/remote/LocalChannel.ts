import http from 'http';
import type { AddressInfo } from 'net';
import type { CommandRegistry } from '../../core/commands/CommandRegistry';
import { RemoteGateway } from '../../core/remote/RemoteGateway';
import { newRemoteSecret, sameSecret } from '../../core/remote/remoteSecrets';
import type { LocalChannelAddress } from '../../core/cli/appRunningMarker';
import { gatewayListener } from './gatewayListener';

/**
 * How the CLI reaches the app when the app is open (#31, #32): an HTTP server bound to 127.0.0.1 only,
 * on a random port, behind a random token that exists for this run of the app. The app writes both
 * into its owner-only running marker, so only the same user's CLI finds them.
 *
 * Usage:
 *   const channel = new LocalChannel(commands);
 *   const { port, token } = await channel.start();
 *   app.on('will-quit', () => channel.stop());
 */
export class LocalChannel {
  private server: http.Server | null = null;

  constructor(private readonly commands: CommandRegistry) {}

  start(): Promise<LocalChannelAddress> {
    const token = newRemoteSecret();
    const gateway = new RemoteGateway({
      commands: this.commands,
      authenticate: (given) => (sameSecret(given, token) ? { kind: 'local' } : null),
    });
    const server = http.createServer(gatewayListener(gateway));
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      // Loopback only: nothing outside this computer can connect.
      server.listen(0, '127.0.0.1', () => resolve({ port: (server.address() as AddressInfo).port, token }));
    });
  }

  stop(): void {
    this.server?.close();
    this.server?.closeAllConnections();
    this.server = null;
  }
}
