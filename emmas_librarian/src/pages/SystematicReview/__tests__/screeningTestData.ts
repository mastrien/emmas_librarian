import type { Article, ScreeningDecision, ScreeningStage } from '../../../types';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';

// Label ids of FakeProjectService's defaults: Incluso, Em dúvida, Excluído, Duplicado.
export const INCLUDED = 1;
export const MAYBE = 2;
export const EXCLUDED = 3;
export const DUPLICATE = 4;

/**
 * An article as the review screens read it.
 *
 * @example reviewArticle(3, 'ConvLSTM', { status: 'read' })
 */
export function reviewArticle(id: number, title: string, extra: Partial<Article> = {}): Article {
  return {
    id,
    project_id: 1,
    title,
    authors: 'Shi, X.',
    year: 2015,
    journal: 'NeurIPS',
    source_databases: '["openalex"]',
    abstract: `Resumo de ${title}`,
    status: 'new',
    ...extra,
  } as Article;
}

/** A stored decision, as the fake keeps them. */
export function storedDecision(
  articleId: number,
  labelId: number,
  stage: ScreeningStage = 'title',
  note: string | null = null,
): ScreeningDecision {
  return {
    id: articleId * 10,
    article_id: articleId,
    label_id: labelId,
    stage,
    note,
    status_before: null,
    decided_at: '',
  };
}

/**
 * A service holding a project "Revisão" with these articles and decisions; the fake keeps decisions in memory, so
 * a screen that decides and reloads sees them.
 */
export function screeningService(articles: Article[], decisions: ScreeningDecision[] = []): FakeProjectService {
  const service = new FakeProjectService();
  service.getProject.mockResolvedValue({ id: 1, name: 'Revisão' } as never);
  service.getArticles.mockResolvedValue(articles);
  service.screeningDecisions = decisions;
  return service;
}
