import QRCode from 'qrcode';

/** Draws a text as a QR code in SVG markup; wraps the library that does it. */
export type QrEncoder = (text: string) => Promise<string>;

/**
 * QR code as SVG (the `qrcode` package). Medium error correction: the code is read from a screen.
 *
 * Usage:
 *   const svg = await encodeQrSvg('https://192.168.0.10:47810/#pair=...');
 */
export const encodeQrSvg: QrEncoder = (text) =>
  QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
