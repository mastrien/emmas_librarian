// Diary dates are stored as local calendar days (YYYY-MM-DD); parsing them as UTC would shift the day.
function toLocalDate(isoDay: string): Date {
  const [y, m, d] = isoDay.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}

/**
 * Long pt-BR label for a diary day, e.g. "quinta-feira, 5 de março de 2026".
 *
 * Usage:
 *   formatDiaryDate('2026-03-05');
 */
export function formatDiaryDate(isoDay: string): string {
  return toLocalDate(isoDay).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Short pt-BR label for the timeline, e.g. "05 de mar.".
 *
 * Usage:
 *   formatDiaryDateShort('2026-03-05');
 */
export function formatDiaryDateShort(isoDay: string): string {
  return toLocalDate(isoDay).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
