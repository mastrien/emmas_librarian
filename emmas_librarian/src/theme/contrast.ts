// WCAG 2.x contrast between two #rrggbb colours. Used by the design-token tests so every text token keeps
// 4.5:1 on every surface of every theme and tone (redesign, Arca 134).

type Rgb = readonly [number, number, number];

/**
 * Parses a 6-digit hex colour.
 * @example hexToRgb('#4f46e5') // [79, 70, 229]
 */
export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`hexToRgb expects a colour like "#1a2b3c", got "${hex}"`);
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance from 0 (black) to 1 (white).
 * @example relativeLuminance('#ffffff') // 1
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contrast ratio from 1 to 21, order of the arguments does not matter.
 * @example contrastRatio('#000000', '#ffffff') // 21
 */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
