import { AppError } from '../../../electron/ipc/errorHandler';
import type { ScreeningSuggestionRepository } from '../../database/ScreeningSuggestionRepository';
import type { ScreeningCriteria, ScreeningSuggestion } from '../../../src/types/screeningSuggestion';
import type { ScreeningEngine } from './ScreeningEngine';
import { criteriaSnapshot, hasCriteria } from '../../../src/utils/screeningCriteria';
import type { OfferedLabel, ScreenedArticle } from './screeningPrompt';

/** The article to read, from wherever the app keeps it. */
export interface SuggestionArticle extends ScreenedArticle {
  id: number;
  projectId: number;
}

/** Where the service finds what it reads. */
export interface SuggestionSources {
  article(articleId: number): SuggestionArticle | null;
  labels(projectId: number): OfferedLabel[];
}

const refused = (code: string, message: string) => new AppError(code, 'USER_ERROR', message);

/**
 * Makes and keeps suggestions (#54). One already made with these criteria costs nothing to ask for again, because it
 * cost tokens. Saving a suggestion never touches the decision.
 *
 * @example await new ScreeningSuggestionService(repo, sources, engine).suggest(3);
 */
export class ScreeningSuggestionService {
  constructor(
    private readonly suggestions: ScreeningSuggestionRepository,
    private readonly sources: SuggestionSources,
    private readonly engine: ScreeningEngine,
    private readonly now: () => number = Date.now,
  ) {}

  async suggest(articleId: number): Promise<ScreeningSuggestion> {
    const article = this.readable(articleId);
    const criteria = this.criteriaOf(article.projectId);
    const snapshot = criteriaSnapshot(criteria);
    const kept = this.suggestions.find(articleId, this.engine.id);
    if (kept?.criteria === snapshot) return kept;
    return this.ask(article, criteria, snapshot);
  }

  private async ask(
    article: SuggestionArticle,
    criteria: ScreeningCriteria,
    snapshot: string,
  ): Promise<ScreeningSuggestion> {
    const started = this.now();
    const answer = await this.engine.suggest(article, criteria, this.sources.labels(article.projectId));
    return this.suggestions.save({
      article_id: article.id,
      label_id: answer.labelId,
      engine: this.engine.id,
      criteria: snapshot,
      confidence: answer.confidence,
      reason: answer.reason,
      quote: answer.quote,
      quote_found: answer.quoteFound ? 1 : 0,
      elapsed_ms: this.now() - started,
      tokens_estimated: answer.tokensEstimated,
    });
  }

  private readable(articleId: number): SuggestionArticle {
    const article = this.sources.article(articleId);
    if (!article) {
      throw refused('ERR_NOT_FOUND', `Artigo não encontrado. Valor recebido: articleId=${articleId}.`);
    }
    if (!article.abstract.trim()) {
      throw refused('ERR_NO_ABSTRACT', 'Este artigo não tem resumo, então não há o que a IA leia.');
    }
    return article;
  }

  // Without criteria the model would guess what the person is looking for.
  private criteriaOf(projectId: number): ScreeningCriteria {
    const criteria = this.suggestions.criteria(projectId);
    if (hasCriteria(criteria)) return criteria;
    throw refused('ERR_NO_CRITERIA', 'Escreva os critérios do projeto para pedir sugestões.');
  }
}
