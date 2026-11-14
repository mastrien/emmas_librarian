import type { ArticleVectorRepository } from '../../database/ArticleVectorRepository';
import type {
  ArticleVectorPlan,
  ArticleVectorStep,
  ScreeningRank,
  ScreeningSimulation,
} from '../../../src/types/screeningOrder';
import type { ScreeningKind } from '../../../src/types';
import {
  examplesNeeded,
  normalized,
  originalFound,
  rankByRelevance,
  simulateFound,
  type LabelledVector,
  type SimulatedArticle,
} from './screeningRanker';

/** Vectors for many texts at once; the app's EmbeddingService is one. */
export interface TextEmbedder {
  embedBatch(texts: string[]): Promise<number[][]>;
}

/** An article the person decided at title and abstract. */
export interface DecidedArticle {
  articleId: number;
  kind: ScreeningKind;
}

/** Where the service finds the decisions and the queue. */
export interface ScreeningOrderSources {
  decided(projectId: number): DecidedArticle[];
}

const BATCH_SIZE = 16;

// "Em dúvida" advances to the full text, so it counts as relevant, as in the evaluation of #54.
const isRelevant = (kind: ScreeningKind) => kind === 'include' || kind === 'maybe';

/**
 * The predicted order of the screening (#55). The vectors are generated only when asked for, since they may go to a paid
 * provider; learning and ordering stay on this computer and never decide anything.
 *
 * @example await new ScreeningOrderService(vectors, sources, embedder, 'ollama/x').rank(3);
 */
export class ScreeningOrderService {
  constructor(
    private readonly vectors: ArticleVectorRepository,
    private readonly sources: ScreeningOrderSources,
    private readonly embedder: TextEmbedder,
    private readonly modelId: string,
  ) {}

  plan(projectId: number): ArticleVectorPlan {
    const pending = this.vectors.needingVector(projectId, this.modelId).length;
    return {
      total: this.vectors.eligibleCount(projectId, this.modelId),
      pending,
      provider: this.modelId.split('/')[0],
      previousModel: pending > 0 ? this.vectors.mostUsedModelBesides(projectId, this.modelId) : null,
    };
  }

  /** Generates the next batch. A failure leaves the rest pending, to try again; what was saved stays. */
  async generateNext(projectId: number): Promise<ArticleVectorStep> {
    const pending = this.vectors.needingVector(projectId, this.modelId);
    const batch = pending.slice(0, BATCH_SIZE);
    if (batch.length === 0) return { generated: 0, pending: 0 };
    const vectors = await this.embedder.embedBatch(batch.map((article) => article.text));
    batch.forEach((article, i) => this.vectors.save(article.id, this.modelId, vectors[i], article.textHash));
    return { generated: batch.length, pending: pending.length - batch.length };
  }

  rank(projectId: number): ScreeningRank {
    const stored = this.vectors.vectors(projectId, this.modelId);
    const decided = this.sources.decided(projectId).filter((d) => d.kind !== 'removed');
    const decidedIds = new Set(this.sources.decided(projectId).map((d) => d.articleId));
    const examples: LabelledVector[] = decided.flatMap(({ articleId, kind }) => {
      const vector = stored.get(articleId);
      return vector ? [{ vector: normalized(vector), relevant: isRelevant(kind) }] : [];
    });
    const relevant = examples.filter((example) => example.relevant).length;
    const needed = examplesNeeded(relevant, examples.length - relevant);
    const ready = needed.needRelevant === 0 && needed.needExcluded === 0;
    const pending = [...stored]
      .filter(([id]) => !decidedIds.has(id))
      .sort(([a], [b]) => a - b)
      .map(([id, vector]) => ({ id, vector: normalized(vector) }));
    return { order: ready ? rankByRelevance(examples, pending) : [], learnedFrom: examples.length, ...needed };
  }

  async simulate(projectId: number): Promise<ScreeningSimulation> {
    const stored = this.vectors.vectors(projectId, this.modelId);
    const decided = this.sources
      .decided(projectId)
      .filter((d) => d.kind !== 'removed')
      .sort((a, b) => a.articleId - b.articleId);
    const articles: SimulatedArticle[] = decided.flatMap(({ articleId, kind }) => {
      const vector = stored.get(articleId);
      return vector ? [{ id: articleId, vector: normalized(vector), relevant: isRelevant(kind) }] : [];
    });
    return {
      articles: articles.length,
      relevant: articles.filter((article) => article.relevant).length,
      predicted: await simulateFound(articles),
      original: originalFound(articles),
      withoutVector: decided.length - articles.length,
    };
  }
}
