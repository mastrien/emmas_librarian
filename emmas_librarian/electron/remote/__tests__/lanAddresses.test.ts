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

  it('answers nothing on a computer without a network', () => {
    expect(lanAddresses({ lo: [v4('127.0.0.1', true)], down: undefined })).toEqual([]);
  });

  it('reads this computer by default', () => {
    expect(Array.isArray(lanAddresses())).toBe(true);
  });
});
