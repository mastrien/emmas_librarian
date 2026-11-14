import os from 'os';

type Interfaces = ReturnType<typeof os.networkInterfaces>;

/**
 * The IPv4 addresses a phone on the same network can use to reach this computer.
 *
 * Usage:
 *   lanAddresses(); // ['192.168.0.10']
 */
export function lanAddresses(interfaces: Interfaces = os.networkInterfaces()): string[] {
  return Object.values(interfaces)
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
}
