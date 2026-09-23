/**
 * A JSON array stored as text (e.g. investigation questions or article ids), or [] when the text is
 * missing, malformed or not an array, so one bad row cannot crash a list.
 *
 * Usage:
 *   const ids = parseJsonList<number>(investigation.articles_ids);
 */
export function parseJsonList<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
