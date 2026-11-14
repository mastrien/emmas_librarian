import type { ArticleVectorRepository } from '../../database/ArticleVectorRepository';
import type { ScreeningSuggestionRepository } from '../../database/ScreeningSuggestionRepository';
import type { ScreeningCriteria, ScreeningSuggestion } from '../../../src/types/screeningSuggestion';
import type { ScreeningKind } from '../../../src/types';
import { criteriaSnapshot } from '../../../src/utils/screeningCriteria';
import type { OfferedLabel } from './screeningPrompt';
import type { DecidedArticle } from './ScreeningOrderService';
import { examplesNeeded, normalized, relevanceOf, train, type SimulatedArticle } from './screeningRanker';

const FOLDS = 5;

// Above and below these the classifier is sure enough to say include or exclude; between them it would say "em dúvida",
// as a person does. Not measured yet: the evaluation is what shows whether they serve.
const INCLUDE_FROM = 0.6;
const MAYBE_FROM = 0.4;

const REASON = 'Classificador local: aprende com as decisões e não escreve justificativa.';

/** How likely relevant the classifier found an article, in a round it did not learn from it. */
export interface HeldOutRelevance {
  articleId: number;
  relevance: number;
}

/** What the evaluation needs, from wherever the app keeps it. */
export interface ClassifierEvaluationSources {
  decided(projectId: number): DecidedArticle[];
  labels(projectId: number): OfferedLabel[];
  criteria(projectId: number): ScreeningCriteria;
}

function canLearnFrom(articles: SimulatedArticle[]): boolean {
  const relevant = articles.filter((article) => article.relevant).length;
  const { needRelevant, needExcluded } = examplesNeeded(relevant, articles.length - relevant);
  return needRelevant === 0 && needExcluded === 0;
}

/**
 * The classifier's verdict on each article, from a round that trained on the others. Testing it on articles it learned
 * from would make it look far better than it is. An article whose round has too few examples gets no verdict.
 *
 * @example heldOutRelevance(articles)[0] // { articleId: 3, relevance: 0.81 }
 */
export function heldOutRelevance(articles: SimulatedArticle[], folds = FOLDS): HeldOutRelevance[] {
  const verdicts: HeldOutRelevance[] = [];
  for (let fold = 0; fold < folds; fold++) {
    const others = articles.filter((_, position) => position % folds !== fold);
    if (!canLearnFrom(others)) continue;
    const weights = train(others);
    articles
      .filter((_, position) => position % folds === fold)
      .forEach(({ id, vector }) => verdicts.push({ articleId: id, relevance: relevanceOf(weights, vector) }));
  }
  return verdicts;
}

/**
 * The kind a relevance stands for.
 *
 * @example kindForRelevance(0.5) // 'maybe'
 */
export function kindForRelevance(relevance: number): ScreeningKind {
  if (relevance >= INCLUDE_FROM) return 'include';
  return relevance >= MAYBE_FROM ? 'maybe' : 'exclude';
}

// The classifier tells relevant from not, not the reason for an exclusion, so it takes the project's first label of the
// kind. A project with no "em dúvida" label gets the side the relevance leans to.
function labelFor(relevance: number, labels: OfferedLabel[]): OfferedLabel | undefined {
  const kind = kindForRelevance(relevance);
  const fallback: ScreeningKind = relevance >= 0.5 ? 'include' : 'exclude';
  return labels.find((label) => label.kind === kind) ?? labels.find((label) => label.kind === fallback);
}

/**
 * Measures the local classifier against the decisions already made (#54), next to the language models. Nothing leaves
 * the computer and no token is spent, beyond the vectors already generated. Its verdicts never appear in the screening:
 * they exist to be compared.
 *
 * @example await new ClassifierEvaluationService(vectors, suggestions, sources, 'ollama/x').evaluate(3);
 */
export class ClassifierEvaluationService {
  constructor(
    private readonly vectors: ArticleVectorRepository,
    private readonly suggestions: ScreeningSuggestionRepository,
    private readonly sources: ClassifierEvaluationSources,
    private readonly embeddingModel: string,
    private readonly now: () => number = Date.now,
  ) {}

  evaluate(projectId: number): ScreeningSuggestion[] {
    const articles = this.decidedWithVectors(projectId);
    const started = this.now();
    const verdicts = heldOutRelevance(articles);
    const elapsed = verdicts.length ? Math.round((this.now() - started) / verdicts.length) : 0;
    const labels = this.sources.labels(projectId);
    const criteria = criteriaSnapshot(this.sources.criteria(projectId));
    return verdicts.flatMap(({ articleId, relevance }) => {
      const label = labelFor(relevance, labels);
      if (!label) return [];
      return [
        this.suggestions.save({
          article_id: articleId,
          label_id: label.id,
          engine: `classificador-local/${this.embeddingModel}`,
          criteria,
          confidence: Math.max(relevance, 1 - relevance),
          reason: REASON,
          quote: null,
          quote_found: 0,
          elapsed_ms: elapsed,
          tokens_estimated: 0,
        }),
      ];
    });
  }

  private decidedWithVectors(projectId: number): SimulatedArticle[] {
    const stored = this.vectors.vectors(projectId, this.embeddingModel);
    return this.sources
      .decided(projectId)
      .filter((decision) => decision.kind !== 'removed')
      .sort((a, b) => a.articleId - b.articleId)
      .flatMap(({ articleId, kind }) => {
        const vector = stored.get(articleId);
        if (!vector) return [];
        return [{ id: articleId, vector: normalized(vector), relevant: kind === 'include' || kind === 'maybe' }];
      });
  }
}
