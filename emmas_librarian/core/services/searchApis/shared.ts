/** Result order the user picks for a search; each base maps it to its own sort parameter. */
export type SortBy = 'relevance' | 'citations' | 'date';

/**
 * 1/0 when the base said whether the article is open access, undefined when it did not
 * (Crossref and WoS never say; OpenAlex and Scopus sometimes omit the field).
 *
 * Usage:
 *   openAccessFlag(raw.open_access?.is_oa); // true → 1, '0' → 0, undefined → undefined
 */
export function openAccessFlag(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

/**
 * Logs a failed search the way every base did before the split, then rethrows it for the orchestrator.
 *
 * Usage:
 *   return await logAndRethrow('OpenAlex', () => requestOpenAlex(...));
 */
export async function logAndRethrow<T>(baseName: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    console.error(`${baseName} fetch error`, e);
    throw e;
  }
}
