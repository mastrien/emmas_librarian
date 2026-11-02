import { AppError } from '../../ipc/errorHandler';
import type { PdfChunkIndexRepository } from '../../database/PdfChunkIndexRepository';
import type { SimilarChunk, VectorStore } from '../VectorStore';
import type { ProjectAnswer, ProjectCitation, ProjectIndexCoverage } from '../../../src/types';
import { parseProjectAnswer, projectQuestionPrompt, type ParsedClaim } from './projectAnswerPrompt';

// What the model reads. The candidates leave room for the limit per article to still fill the sources.
const MAX_SOURCES = 20;
const MAX_PER_ARTICLE = 5;
const CANDIDATES = 100;

/** Turns text into a vector; the app's EmbeddingService is one. */
export interface QuestionEmbedder {
  embed(text: string): Promise<number[]>;
}

/** The AI model that answers. */
export type AnswerCompletion = (prompt: string) => Promise<string>;

/**
 * The chunks the model reads: nearest first, at most `perArticle` from each so a long article does not fill the
 * answer alone. When the limit leaves room (few articles), the nearest of the rest fill it.
 *
 * @example pickSources(chunks, 20, 5).length // at most 20
 */
export function pickSources(chunks: SimilarChunk[], max: number, perArticle: number): SimilarChunk[] {
  const taken = new Map<number, number>();
  const balanced = chunks.filter((chunk) => {
    const count = taken.get(chunk.articleId) ?? 0;
    taken.set(chunk.articleId, count + 1);
    return count < perArticle;
  });
  const rest = chunks.filter((chunk) => !balanced.includes(chunk));
  return [...balanced, ...rest].slice(0, max);
}

/**
 * Answers a question from the indexed PDFs of several articles, each statement with its article and page (#53).
 *
 * @example await new ProjectQuestionService(store, index, embedder, complete, 'openai/x').ask('Qual a amostra?', [1, 2]);
 */
export class ProjectQuestionService {
  constructor(
    private readonly store: VectorStore,
    private readonly index: PdfChunkIndexRepository,
    private readonly embedder: QuestionEmbedder,
    private readonly complete: AnswerCompletion,
    private readonly currentModel: string,
  ) {}

  /** What a question would read: the articles it covers, those left out, and those indexed with another model. */
  coverage(articleIds: number[]): ProjectIndexCoverage {
    return this.index.coverage(articleIds, this.currentModel);
  }

  async ask(question: string, articleIds: number[]): Promise<ProjectAnswer> {
    const asked = question.trim();
    if (!asked) {
      throw new AppError(
        'ERR_EMPTY_QUESTION',
        'VALIDATION_ERROR',
        `Escreva a pergunta. Valor recebido: ${JSON.stringify(question)}. Esperado: um texto não vazio.`,
      );
    }
    const coverage = this.coverage(articleIds);
    const unanswered: ProjectAnswer = { question: asked, claims: [], coverage };
    if (coverage.indexed.length === 0) return unanswered;

    const sources = await this.retrieve(
      asked,
      coverage.indexed.map((article) => article.id),
    );
    if (sources.length === 0) return unanswered;
    const titles = new Map(coverage.indexed.map((article) => [article.id, article]));
    const prompt = projectQuestionPrompt(
      asked,
      sources.map((s) => ({ text: s.text, page: s.page, title: titles.get(s.articleId)?.title ?? '' })),
    );
    const claims = parseProjectAnswer(await this.complete(prompt), sources.length);
    return { ...unanswered, claims: claims.map((claim) => this.withCitations(claim, sources, coverage)) };
  }

  private async retrieve(question: string, articleIds: number[]): Promise<SimilarChunk[]> {
    const vector = await this.embedder.embed(question);
    this.assertSameSize(vector.length);
    const nearest = this.store.searchSimilarAcross(vector, CANDIDATES, articleIds);
    return pickSources(nearest, MAX_SOURCES, MAX_PER_ARTICLE);
  }

  // Vectors of different sizes cannot be compared. The store's own check clears the index when sizes differ, which a
  // question must never do: changing the model and asking something would erase every article's chunks.
  private assertSameSize(size: number): void {
    const indexed = this.store.indexedDimension();
    if (indexed === null || indexed === size) return;
    throw new AppError(
      'ERR_EMBEDDING_DIMENSION',
      'USER_ERROR',
      `Os PDFs foram indexados com vetores de ${indexed} dimensões e o modelo de embeddings atual gera ${size}. Volte ao modelo anterior para perguntar; o índice não foi alterado.`,
    );
  }

  private withCitations(claim: ParsedClaim, sources: SimilarChunk[], coverage: ProjectIndexCoverage) {
    const citations = claim.sources.map((number): ProjectCitation => {
      const source = sources[number - 1];
      const article = coverage.indexed.find((a) => a.id === source.articleId);
      return {
        articleId: source.articleId,
        title: article?.title ?? '',
        authors: article?.authors ?? null,
        year: article?.year ?? null,
        page: source.page,
        bbox: source.bbox,
        text: source.text,
      };
    });
    return { text: claim.text, citations };
  }
}
