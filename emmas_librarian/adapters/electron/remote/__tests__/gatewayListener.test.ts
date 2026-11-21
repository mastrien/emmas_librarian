// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { CommandRegistry } from '../../../../core/commands/CommandRegistry';
import { RemoteGateway } from '../../../../core/remote/RemoteGateway';
import { gatewayListener } from '../gatewayListener';

let server: http.Server | null = null;

afterEach(() => server?.close());

async function pageHeaders(): Promise<Headers> {
  const gateway = new RemoteGateway({ commands: new CommandRegistry(), authenticate: () => null });
  const site = (pathname: string) =>
    pathname === '/' ? { status: 200, contentType: 'text/html; charset=utf-8', body: '<title>x</title>' } : null;
  server = http.createServer(gatewayListener(gateway, { site }));
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`)).headers;
}

describe('the pages the LAN server serves', () => {
  it('may run only their own scripts and talk only to this server', async () => {
    const policy = (await pageHeaders()).get('content-security-policy') ?? '';
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it('may load the fonts a PDF carries as data: URLs, which pdf.js needs to draw its text', async () => {
    expect((await pageHeaders()).get('content-security-policy')).toContain("font-src 'self' data:");
  });

  it('is never cached', async () => {
    expect((await pageHeaders()).get('cache-control')).toBe('no-store');
  });
});
