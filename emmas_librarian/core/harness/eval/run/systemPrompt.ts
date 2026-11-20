/** 'YYYY-MM-DD' as a local date; a case names today as text. */
export function dayFromText(text: string | undefined): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? '2026-11-15');
  if (!match) throw new Error(`[ERR_INVALID_DAY] Offending value: ${JSON.stringify(text)}. Expected YYYY-MM-DD.`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
