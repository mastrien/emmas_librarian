import { describe, it, expect } from 'vitest';
import { lanAddresses } from '../lanAddresses';

const v4 = (address: string, internal = false) => ({ address, family: 'IPv4', internal }) as never;
const v6 = (address: string) => ({ address, family: 'IPv6', internal: false }) as never;

describe('lanAddresses', () => {
  it('keeps the IPv4 addresses of the network, without loopback and IPv6', () => {
    const interfaces = {
      lo: [v4('127.0.0.1', true)],
      wlan0: [v6('fe80::1'), v4('192.168.0.10')],
      eth0: [v4('10.0.0.5')],
    };

    expect(lanAddresses(interfaces)).toEqual(['192.168.0.10', '10.0.0.5']);
  });

  // Regression: with Radmin VPN listed first the invite pointed the phone to 26.x, unreachable from the Wi-Fi.
  it('puts the real network before VPNs and virtual switches, whatever order the system lists them', () => {
    const interfaces = {
      'Ethernet 7': [v4('192.168.56.1')],
      'Radmin VPN': [v4('26.48.209.248')],
      'Ethernet 5': [v4('192.168.15.17')],
      'vEthernet (WSL)': [v4('172.17.32.1')],
    };

    expect(lanAddresses(interfaces)).toEqual(['192.168.15.17', '192.168.56.1', '26.48.209.248', '172.17.32.1']);
  });

  it('answers nothing on a computer without a network', () => {
    expect(lanAddresses({ lo: [v4('127.0.0.1', true)], down: undefined })).toEqual([]);
  });

  it('reads this computer by default', () => {
    expect(Array.isArray(lanAddresses())).toBe(true);
  });
});
