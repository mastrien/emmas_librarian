import { describe, it, expect } from 'vitest';
import { encodeQrSvg } from '../qrEncoder';

describe('encodeQrSvg', () => {
  it('draws the text as an SVG QR code, bigger for longer texts', async () => {
    const short = await encodeQrSvg('https://192.168.0.10:47810/');
    const long = await encodeQrSvg(`https://192.168.0.10:47810/#pair=${'x'.repeat(120)}`);

    expect(short).toMatch(/^<svg[^>]*viewBox="0 0 (\d+) \1"/);
    const side = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)![1]);
    expect(side(long)).toBeGreaterThan(side(short));
  });
});
