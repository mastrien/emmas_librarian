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

/**
 * A timestamp the database wrote ("2026-03-05 21:42:10", from CURRENT_TIMESTAMP, which is UTC) as a date. The text has
 * no zone, and read as it is JavaScript takes it for local time and shows every version hours off.
 *
 * @example parseDbTimestamp('2026-03-05 21:42:10') // 2026-03-05T21:42:10Z
 */
export function parseDbTimestamp(value: string): Date {
  const bare = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(bare ? `${value.replace(' ', 'T')}Z` : value);
}

const dayNumber = (date: Date) =>
  Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000);

/**
 * When a version was saved, the way the history lists it: "hoje 21:42", "ontem 21:42", "05/03 21:42" and, from another
 * year, "05/03/2025 21:42".
 *
 * @example versionStamp('2026-03-05 21:42:00', new Date(2026, 2, 5, 23, 0)) // 'hoje 18:42' (in Brasília)
 */
export function versionStamp(value: string, now: Date = new Date()): string {
  const date = parseDbTimestamp(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const days = dayNumber(now) - dayNumber(date);
  if (days === 0) return `hoje ${time}`;
  if (days === 1) return `ontem ${time}`;
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return date.getFullYear() === now.getFullYear() ? `${day} ${time}` : `${day}/${date.getFullYear()} ${time}`;
}
