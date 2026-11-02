import type { Article, CitationSeed } from '../types';

export const SNOWBALL_DEFAULT_LIMIT = 200;
// One run can reach thousands of works (a well-known article is cited by many); this keeps the preview readable.
export const SNOWBALL_MAX_LIMIT = 1000;

/** Why an article cannot be explored; the modal shows it instead of failing. */
export const NO_CITATION_LOOKUP = 'Sem DOI nem identificador do OpenAlex: não dá para localizar este artigo.';

function openAlexIdOf(cslJson: unknown): string | undefined {
  if (typeof cslJson !== 'string' || !cslJson) return undefined;
  try {
    const id = (JSON.parse(cslJson) as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id.includes('openalex.org/') ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * How to find an article on OpenAlex: the id it came with, else its DOI; null when it has neither.
 *
 * @example citationSeedOf({ id: 1, title: 'T', doi: '10.1/x' }) // { articleId: 1, title: 'T', doi: '10.1/x' }
 */
export function citationSeedOf(article: Pick<Article, 'id' | 'title' | 'doi' | 'csl_json'>): CitationSeed | null {
  const openAlexId = openAlexIdOf(article.csl_json);
  const doi = article.doi?.trim() || undefined;
  if (!openAlexId && !doi) return null;
  return { articleId: article.id, title: article.title, openAlexId, doi };
}
