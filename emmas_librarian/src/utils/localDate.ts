/**
 * Local calendar date as YYYY-MM-DD. `toISOString()` gives the UTC date, which in Brazil (UTC-3)
 * is already tomorrow after 21:00 and shifted deadline badges, diary pages and backup names by a day.
 *
 * @example localIsoDate(new Date(2026, 8, 26, 22, 30)) // '2026-09-26'
 */
export function localIsoDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
