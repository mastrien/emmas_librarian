import type { Article, ScreeningDecision, ScreeningStage, SearchHistoryItem } from '../../../../types';
import { prismaFlow, type PrismaFlow } from '../../../../utils/prismaFlow';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';

// Label ids of FakeProjectService's defaults: Incluso, Em dúvida, Excluído, Duplicado.
export const INC = 1;
export const MAYBE = 2;
export const EXC = 3;

/**
 * A saved search as the history keeps it.
 *
 * @example savedSearch(1, { scopus: { count: 100, requested: 100 } }, 90, 80)
 */
export function savedSearch(id: number, breakdown: object, unique: number | null, added: number): SearchHistoryItem {
  return {
    id,
    unified_query: 'nowcasting',
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

/** The flow of that small project, with the default labels. */
export function smallFlow(): PrismaFlow {
  const labels = new FakeProjectService().screeningLabels;
  return prismaFlow({ searches: SEARCHES, articles: ARTICLES, labels, decisions: DECISIONS, manual: [] });
}

/** A service holding that project for the review page. */
export function prismaService(): FakeProjectService {
  const service = new FakeProjectService();
  service.getProject.mockResolvedValue({ id: 1, name: 'Revisão' } as never);
  service.getArticles.mockResolvedValue(ARTICLES);
  service.getSearchHistory.mockResolvedValue(SEARCHES);
  service.screeningDecisions = DECISIONS;
  return service;
}
