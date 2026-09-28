/**
 * How many chips fit on one line before a "+N filtros" button, keeping the chips in order.
 * `trailingWidth` is what always follows the chips ("Limpar"); `moreWidth` is the "+N" button,
 * needed only when some chip is left out.
 *
 * @example chipsThatFit([80, 80, 80], 200, 60, 50, 6) // 1: one chip + "+2 filtros" + "Limpar"
 */
export function chipsThatFit(
  chipWidths: number[],
  available: number,
  moreWidth: number,
  trailingWidth: number,
  gap: number,
): number {
  const lineWidth = (count: number, withMore: boolean) =>
    chipWidths.slice(0, count).reduce((sum, w) => sum + w + gap, 0) + (withMore ? moreWidth + gap : 0) + trailingWidth;
  if (lineWidth(chipWidths.length, false) <= available) return chipWidths.length;
  let count = chipWidths.length - 1;
  while (count > 0 && lineWidth(count, true) > available) count--;
  return count;
}
