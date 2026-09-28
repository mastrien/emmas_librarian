/**
 * DOI in the form used to compare two articles: no resolver prefix, trimmed, lower case.
 * DOIs are case-insensitive, and the bases disagree on case (Scopus/WoS often send 10.1016/J.X).
 *
 * @example doiKey(' https://doi.org/10.1016/J.Env.2024 ') // '10.1016/j.env.2024'
 */
export function doiKey(doi: string | null | undefined): string {
  if (!doi) return '';
  return doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .toLowerCase();
}
