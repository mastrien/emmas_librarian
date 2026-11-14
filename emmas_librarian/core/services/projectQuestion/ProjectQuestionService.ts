import { AppError } from '../../../electron/ipc/errorHandler';
import type { PdfChunkIndexRepository } from '../../database/PdfChunkIndexRepository';
import type { SimilarChunk, VectorStore } from '../VectorStore';
import type {
  AskClaim,
  AskCitation,
  ProjectAnswer,
  ProjectIndexArticle,
  ProjectIndexCoverage,
} from '../../../src/types/ask';
import { parseProjectAnswer, projectQuestionPrompt, type AskTurn, type ParsedClaim } from './projectAnswerPrompt';

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
 * Leaves one of each chunk: an article copied to another project has the same chunks, and over both projects they
 * would take the places of other articles.
 *
 * @example withoutCopies(nearest).length // at most nearest.length
 */
export function withoutCopies(chunks: SimilarChunk[]): SimilarChunk[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const key = `${chunk.page}|${chunk.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Refuses vectors of a size the index cannot compare with. Only recalculating, which the person asks for, may clear the
 * index: neither a search nor changing the model in the settings can erase what was paid for.
 *
 * @example assertSameVectorSize(store.indexedDimension(), vector.length);
 */
export function assertSameVectorSize(indexed: number | null, size: number): void {
  if (indexed === null || indexed === size) return;
  throw new AppError(
    'ERR_EMBEDDING_DIMENSION',
    'USER_ERROR',
    `Os PDFs foram indexados com vetores de ${indexed} dimensões e o modelo de embeddings atual gera ${size}. Recalcule os PDFs ou volte ao modelo anterior; o índice não foi alterado.`,
  );
}

/**
 * Refuses to search a PDF indexed by another model: the vectors fit, but the nearest ones would mean nothing, with no
 * error to show for it. `model` is null for what was indexed before the app recorded it.
 *
 * @example assertIndexedWith('openai/antigo', 'openai/novo'); // throws
 */
export function assertIndexedWith(model: string | null, current: string): void {
  if (model === current) return;
  throw new AppError(
    'ERR_EMBEDDING_MODEL',
    'USER_ERROR',
    `Este PDF foi indexado com outro modelo de embeddings (${model ?? 'não registrado'}) e o atual é ${current}. Recalcule os PDFs para usá-lo; o índice não foi alterado.`,
  );
}

function toCitation(source: SimilarChunk, article: ProjectIndexArticle | undefined): AskCitation {
  return {
    articleId: source.articleId,
    title: article?.title ?? '',
    authors: article?.authors ?? null,
    year: article?.year ?? null,
    page: source.page,
    bbox: source.bbox,
    text: source.text,
    pdfPath: article?.pdfPath ?? null,
  };
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

  async ask(question: string, articleIds: number[], turns: AskTurn[] = []): Promise<ProjectAnswer> {
    const coverage = this.coverage(articleIds);
    const nothing: ProjectAnswer = { question, claims: [], chunksRead: 0, articlesRead: 0, coverage };
    if (coverage.indexed.length === 0) return nothing;

    const sources = await this.retrieve(question, coverage, turns);
    if (sources.length === 0) return nothing;
    const prompt = projectQuestionPrompt(question, this.promptSources(sources, coverage), turns);
    const parsed = parseProjectAnswer(await this.complete(prompt), sources.length);
    return {
      ...nothing,
      claims: parsed.map((claim) => this.withCitations(claim, sources, coverage)),
      chunksRead: sources.length,
      articlesRead: new Set(sources.map((s) => s.articleId)).size,
    };
  }

  // A follow-up ("e no Almeida?") says little by itself, so the search also looks for what the last question asked.
  private async retrieve(question: string, coverage: ProjectIndexCoverage, turns: AskTurn[]): Promise<SimilarChunk[]> {
    const last = turns[turns.length - 1];
    const vector = await this.embedder.embed(last ? `${last.question}\n${question}` : question);
    assertSameVectorSize(this.store.indexedDimension(), vector.length);
    const ids = coverage.indexed.map((article) => article.id);
    const nearest = this.store.searchSimilarAcross(vector, CANDIDATES, ids);
    return pickSources(withoutCopies(nearest), MAX_SOURCES, MAX_PER_ARTICLE);
  }

  private promptSources(sources: SimilarChunk[], coverage: ProjectIndexCoverage) {
    const titles = new Map(coverage.indexed.map((article) => [article.id, article.title]));
    return sources.map((s) => ({ text: s.text, page: s.page, title: titles.get(s.articleId) ?? '' }));
  }

  private withCitations(claim: ParsedClaim, sources: SimilarChunk[], coverage: ProjectIndexCoverage): AskClaim {
    const articles = new Map(coverage.indexed.map((article) => [article.id, article]));
    const citations = claim.sources.map((number) => {
      const source = sources[number - 1];
      return toCitation(source, articles.get(source.articleId));
    });
    return { text: claim.text, citations, unverified: claim.unverified };
  }
}
