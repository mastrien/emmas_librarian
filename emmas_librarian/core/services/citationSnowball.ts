import type {
  CitationDirection,
  CitationRequest,
  CitationSeed,
  CitationSeedCount,
  SearchBaseOutcome,
} from '../../src/types';
import { SNOWBALL_MAX_LIMIT } from '../../src/utils/citationSeeds';
import type { ApiIntegrator } from './ApiIntegrator';
import type { PagedResult } from './searchApis/paginate';
import type { NormalizedArticle } from './types';

/**
 * Rejects a request the modal cannot send, before any call to OpenAlex.
 *
 * @example validateCitationRequest({ seeds: [seed], directions: ['references'], limit: 200 })
 */
export function validateCitationRequest({ seeds, directions, limit }: CitationRequest): void {
  if (seeds.length === 0)
    throw new Error('Explorar citações sem artigo. Offending value: seeds=[]. Expected shape: ao menos um artigo.');
  if (directions.length === 0) {
    throw new Error(
      'Explorar citações sem direção. Offending value: directions=[]. Expected shape: "references" e/ou "citedBy".',
    );
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > SNOWBALL_MAX_LIMIT) {
    throw new Error(
      `Limite inválido. Offending value: limit=${limit}. Expected shape: inteiro de 1 a ${SNOWBALL_MAX_LIMIT}.`,
    );
  }
}

/**
 * How much each article has to offer, shown before anything is downloaded (the volume grows fast).
 *
 * @example await countCitations(api, [seed], '') // [{ articleId: 1, title: 'T', found: true, references: 30, citedBy: 8 }]
 */
export function countCitations(
  api: ApiIntegrator,
  seeds: CitationSeed[],
  apiKey: string,
): Promise<CitationSeedCount[]> {
  return Promise.all(
    seeds.map(async ({ articleId, title, openAlexId, doi }) => {
      const info = await api.fetchCitationSeed({ openAlexId, doi }, apiKey);
      return {
        articleId,
        title,
        found: info !== null,
        references: info?.referencedIds.length ?? 0,
        citedBy: info?.citedByCount ?? 0,
      };
    }),
  );
}

interface SnowballResult {
  articles: NormalizedArticle[];
  outcome: SearchBaseOutcome;
}

function fetchDirection(
  api: ApiIntegrator,
  direction: CitationDirection,
  info: { openAlexId: string; referencedIds: string[] },
  budget: number,
  apiKey: string,
): Promise<PagedResult> {
  return direction === 'references'
    ? api.searchReferencedWorks(info.referencedIds, budget, apiKey)
    : api.searchCitingWorks(info.openAlexId, budget, apiKey);
}

function limitWarning(found: number, limit: number): string | undefined {
  return found > limit ? `Limite de ${limit} atingido: havia ${found} trabalhos nestas citações.` : undefined;
}

/**
 * Downloads what the seeds cite and what cites them, one request at a time and splitting the limit evenly, so the
 * first article of a selection cannot use it all. A failure after something arrived keeps it and says why it stopped.
 *
 * @example await runSnowball(api, { seeds: [seed], directions: ['references'], limit: 200 }, '')
 */
export async function runSnowball(
  api: ApiIntegrator,
  request: CitationRequest,
  apiKey: string,
): Promise<SnowballResult> {
  const { seeds, directions, limit } = request;
  const budget = Math.ceil(limit / (seeds.length * directions.length));
  const articles: NormalizedArticle[] = [];
  const outcome: SearchBaseOutcome = { count: 0, requested: limit, available: 0, requests: 0 };
  try {
    for (const seed of seeds) {
      const info = await api.fetchCitationSeed({ openAlexId: seed.openAlexId, doi: seed.doi }, apiKey);
      if (!info) continue;
      outcome.requests = (outcome.requests ?? 0) + 1;
      for (const direction of directions) {
        const page = await fetchDirection(api, direction, info, budget, apiKey);
        articles.push(...page.articles);
        outcome.requests += page.requests;
        outcome.available = (outcome.available ?? 0) + (page.available ?? page.articles.length);
        if (page.warning) outcome.warning = page.warning;
      }
    }
  } catch (err) {
    if (articles.length === 0) throw err;
    outcome.warning = `Parou antes do fim: ${err instanceof Error ? err.message : String(err)}`;
  }
  outcome.count = articles.length;
  outcome.warning ??= limitWarning(outcome.available ?? 0, limit);
  return { articles, outcome };
}

/**
 * How the run appears in the history and on the diagram. "Snowballing" before the colon is what PRISMA shows as how
 * the articles entered the project.
 *
 * @example snowballQuery([{ title: 'A' }]) // 'Snowballing: A'
 */
export function snowballQuery(seeds: Pick<CitationSeed, 'title'>[]): string {
  const [first] = seeds;
  return seeds.length === 1
    ? `Snowballing: ${first.title}`
    : `Snowballing: ${seeds.length} artigos (${first.title}; …)`;
}

/**
 * The source the new articles are tagged with on the PRISMA diagram.
 *
 * @example snowballSourceName([{ title: 'A' }]) // 'Citações de "A"'
 */
export function snowballSourceName(seeds: Pick<CitationSeed, 'title'>[]): string {
  return seeds.length === 1 ? `Citações de "${seeds[0].title}"` : `Citações de ${seeds.length} artigos`;
}
