import net from 'node:net';

/**
 * A TCP port nobody is listening on, asked from the operating system, so two runs never fight for 8089.
 *
 * Usage:
 *   const port = await findFreePort(); // e.g. 54213
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}
