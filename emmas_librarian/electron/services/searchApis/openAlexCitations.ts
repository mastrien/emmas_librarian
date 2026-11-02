import { logAndRethrow } from './shared';
import { rateLimited, type PagedResult } from './paginate';
import { searchOpenAlex } from './openAlex';

const OPENALEX_WORKS = 'https://api.openalex.org/works';

// OpenAlex's filtering page allows 100 values joined with "|", but its API guide says 50: the lower one holds for both.
export const OPENALEX_OR_BATCH = 50;

/** How to find a work on OpenAlex: its id when the article came from there, else its DOI. */
export interface CitationLookup {
  openAlexId?: string;
  doi?: string;
}

/** What a work cites and how many cite it, read before anything is downloaded. */
export interface CitationSeedInfo {
  openAlexId: string;
  referencedIds: string[];
  citedByCount: number;
}

/**
 * The short id of a work.
 *
 * @example shortOpenAlexId('https://openalex.org/W2741809807') // 'W2741809807'
 */
export const shortOpenAlexId = (id: string): string => id.split('/').pop() ?? id;

function workUrl({ openAlexId, doi }: CitationLookup): string {
  const key = openAlexId ? shortOpenAlexId(openAlexId) : `doi:${encodeURIComponent(doi ?? '')}`;
  return `${OPENALEX_WORKS}/${key}?select=id,referenced_works,cited_by_count`;
}

/**
 * Finds a work and what it cites. Null when OpenAlex does not know it, which is not a failure of the search.
 *
 * @example await fetchCitationSeed({ doi: '10.1/x' }) // { openAlexId: 'W1', referencedIds: ['W2'], citedByCount: 4 }
 */
export function fetchCitationSeed(lookup: CitationLookup, apiKey: string = ''): Promise<CitationSeedInfo | null> {
  return logAndRethrow('OpenAlex', async () => {
    const init = apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined;
    const response = await fetch(workUrl(lookup), init);
    if (response.status === 404) return null;
    if (response.status === 429) throw rateLimited('OpenAlex', response);
    if (!response.ok) throw new Error(`Erro ${response.status} no OpenAlex ao localizar o artigo.`);
    const work = (await response.json()) as { id?: string; referenced_works?: string[]; cited_by_count?: number };
    return {
      openAlexId: shortOpenAlexId(work.id ?? ''),
      referencedIds: (work.referenced_works ?? []).map(shortOpenAlexId),
      citedByCount: work.cited_by_count ?? 0,
    };
  });
}

function batchesOf<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/**
 * Backward snowballing: the works a list of ids points to, in batches of the OR filter, up to `limit`. A failure
 * after the first batch keeps what arrived and says why it stopped.
 *
 * @example await searchReferencedWorks(['W1', 'W2'], 200)
 */
export async function searchReferencedWorks(ids: string[], limit: number, apiKey: string = ''): Promise<PagedResult> {
  const result: PagedResult = { articles: [], requests: 0, available: ids.length };
  for (const batch of batchesOf(ids.slice(0, limit).map(shortOpenAlexId), OPENALEX_OR_BATCH)) {
    try {
      const page = await searchOpenAlex(`openalex_id:${batch.join('|')}`, 'citations', batch.length, apiKey);
      result.articles.push(...page.articles);
      result.requests += page.requests;
    } catch (err) {
      if (result.articles.length === 0) throw err;
      result.warning = `Parou antes do fim: ${err instanceof Error ? err.message : String(err)}`;
      break;
    }
  }
  return result;
}

/**
 * Forward snowballing: the works that cite this one, the most cited first, up to `limit`.
 *
 * @example await searchCitingWorks('W1', 200)
 */
export function searchCitingWorks(openAlexId: string, limit: number, apiKey: string = ''): Promise<PagedResult> {
  return searchOpenAlex(`cites:${shortOpenAlexId(openAlexId)}`, 'citations', limit, apiKey);
}
