import type { Article, ScreeningDecision, ScreeningStage, SearchHistoryItem } from '../../../../types';
import { prismaFlow, type PrismaFlow, type PrismaInput } from '../../../../utils/prismaFlow';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';

// Label ids of FakeProjectService's defaults: Incluso, Em dúvida, Excluído, Duplicado.
export const INC = 1;
export const MAYBE = 2;
export const EXC = 3;

/**
 * A saved history entry as the app keeps it.
 *
 * @example savedSearch(1, { scopus: { count: 100, requested: 100 } }, 90, 80)
 */
export function savedSearch(
  id: number,
  breakdown: object,
  unique: number | null,
  added: number,
  query = 'nowcasting',
): SearchHistoryItem {
  return {
    id,
    unified_query: query,
    translated_queries: '{}',
    total_results: added,
    results_breakdown: JSON.stringify(breakdown),
    created_at: '2026-09-12 10:00:00',
    unique_results: unique,
  };
}

export const prismaArticle = (id: number, extra: Partial<Article> = {}): Article =>
  ({ id, project_id: 1, title: `Estudo ${id}`, year: 2020, status: 'new', search_id: 1, ...extra }) as Article;

export const decision = (articleId: number, labelId: number, stage: ScreeningStage = 'title'): ScreeningDecision => ({
  id: articleId * 10 + (stage === 'full' ? 1 : 0),
  article_id: articleId,
  label_id: labelId,
  stage,
  note: null,
  status_before: null,
  decided_at: '',
});

// 3 articles from one search (5 + 4 results, 4 unique, 3 new): 1 excluded, 1 included and 1 in doubt at title.
export const ARTICLES = [prismaArticle(1), prismaArticle(2), prismaArticle(3)];
export const DECISIONS = [decision(1, EXC), decision(2, INC), decision(3, MAYBE)];
export const SEARCHES = [
  savedSearch(1, { openalex: { count: 5, requested: 50 }, scopus: { count: 4, requested: 4 } }, 4, 3),
];

// The same project plus 2 articles added by hand (logged under the base "Manual"): 4 is included at full text,
// as is 2, so the two can be marked as of the same study; 5 waits for everything.
export const OUTSIDE_ARTICLES = [prismaArticle(4, { search_id: 2 }), prismaArticle(5, { search_id: 2 })];
export const OUTSIDE_SEARCH = savedSearch(
  2,
  { Manual: { count: 2 } },
  null,
  2,
  'Adição manual de artigo avulso: Estudo 4',
);
const OUTSIDE_DECISIONS = [decision(2, INC, 'full'), decision(4, INC, 'full')];

function smallInput(withOutside: boolean): PrismaInput {
  return {
    searches: withOutside ? [...SEARCHES, OUTSIDE_SEARCH] : SEARCHES,
    articles: withOutside ? [...ARTICLES, ...OUTSIDE_ARTICLES] : ARTICLES,
    labels: new FakeProjectService().screeningLabels,
    decisions: withOutside ? [...DECISIONS, ...OUTSIDE_DECISIONS] : DECISIONS,
    records: { sources: [], origins: [], studyLinks: [] },
  };
}

/** The flow of the small databases-only project, with the default labels. */
export function smallFlow(): PrismaFlow {
  return prismaFlow(smallInput(false));
}

/** The flow of the small project with its two articles from outside the searches: two columns. */
export function twoColumnFlow(): PrismaFlow {
  return prismaFlow(smallInput(true));
}

/** A service holding that project for the review page; `withOutside` adds the articles added by hand. */
export function prismaService(withOutside = false): FakeProjectService {
  const input = smallInput(withOutside);
  const service = new FakeProjectService();
  service.getProject.mockResolvedValue({ id: 1, name: 'Revisão' } as never);
  service.getArticles.mockResolvedValue(input.articles);
  service.getSearchHistory.mockResolvedValue(input.searches);
  service.screeningDecisions = input.decisions;
  return service;
}
