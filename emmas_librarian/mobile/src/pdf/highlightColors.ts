/** The colour names the desktop's reader stores; the phone must write the same ones so both draw them. */
export const HIGHLIGHT_COLORS = ['yellow', 'lightgreen', 'lightblue', 'lightpink', 'plum'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const COLOR_LABELS: { [color in HighlightColor]: string } = {
  yellow: 'Amarelo',
  lightgreen: 'Verde',
  lightblue: 'Azul',
  lightpink: 'Rosa',
  plum: 'Lilás',
};

/** The translucent fill drawn over the page for a stored colour name (an unknown name is drawn yellow). */
export function overlayFill(color: string): string {
  const known = (HIGHLIGHT_COLORS as readonly string[]).includes(color) ? color : 'yellow';
  return `color-mix(in srgb, ${known} 45%, transparent)`;
}
