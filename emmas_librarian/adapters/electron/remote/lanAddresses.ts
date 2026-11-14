import os from 'os';

type Interfaces = ReturnType<typeof os.networkInterfaces>;
interface Candidate {
  name: string;
  address: string;
}

// Adapters a phone on the Wi-Fi cannot reach: VPNs, virtual machines, containers and WSL.
const VIRTUAL_ADAPTER =
  /vethernet|virtualbox|vmware|vmnet|hyper-v|wsl|docker|radmin|hamachi|zerotier|tailscale|vpn|tap-|tun/i;
// The default range of the VirtualBox host-only network, which looks like any other 192.168.x address.
const VIRTUALBOX_HOST_ONLY = /^192\.168\.56\./;
const PRIVATE_IPV4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

// 0 = a private address on a physical adapter (the home or office network), 2 = anything a phone cannot use.
function rank({ name, address }: Candidate): number {
  if (VIRTUAL_ADAPTER.test(name) || VIRTUALBOX_HOST_ONLY.test(address)) return 2;
  return PRIVATE_IPV4.test(address) ? 0 : 1;
}

function candidatesOf(interfaces: Interfaces): Candidate[] {
  return Object.entries(interfaces).flatMap(([name, addresses]) =>
    (addresses ?? [])
      .filter((address) => address.family === 'IPv4' && !address.internal)
      .map((address) => ({ name, address: address.address })),
  );
}

/**
 * The IPv4 addresses a phone on the same network can use to reach this computer, the most likely first.
 *
 * The pairing invite uses the first one, so a VPN (Radmin, Hamachi) or a virtual switch (Hyper-V, WSL,
 * VirtualBox) listed before the real network must not win: the phone would be sent to an address it cannot reach.
 *
 * Usage:
 *   lanAddresses(); // ['192.168.0.10', '26.48.209.248']
 */
export function lanAddresses(interfaces: Interfaces = os.networkInterfaces()): string[] {
  // Array.prototype.sort is stable: inside the same rank the order the system listed them in is kept.
  return candidatesOf(interfaces)
    .sort((first, second) => rank(first) - rank(second))
    .map((candidate) => candidate.address);
}
