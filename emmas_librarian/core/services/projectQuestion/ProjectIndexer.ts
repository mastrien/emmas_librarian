import type { PdfChunkIndexRepository } from '../../database/PdfChunkIndexRepository';
import type { PdfTextChunk } from '../PdfExtractor';
import type { VectorStore } from '../VectorStore';
import type {
  AskIndexPlan,
  AskIndexProgress,
  AskIndexResult,
  ProjectIndexArticle,
  ProjectIndexCoverage,
} from '../../../src/types/ask';
import { assertSameVectorSize, type QuestionEmbedder } from './ProjectQuestionService';

/** Vectors for many texts at once; the app's EmbeddingService is one. */
export interface BatchEmbedder extends QuestionEmbedder {
  embedBatch(texts: string[]): Promise<number[][]>;
}

/** The text of a PDF, in chunks with page and position. */
export type PdfChunkReader = (pdfPath: string) => Promise<PdfTextChunk[]>;

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const pendingOf = (coverage: ProjectIndexCoverage): ProjectIndexArticle[] => [
  ...coverage.withoutIndex,
  ...coverage.outdated,
];

/**
 * Indexes the PDFs a search could not read: those never indexed (#53) and those of another embedding model. Each PDF is
 * written whole or not at all, so after a failure what is left is simply still pending.
 *
 * @example const { failed } = await new ProjectIndexer(store, index, embedder, readPdf, 'openai/x').indexMissing([1, 2]);
 */
export class ProjectIndexer {
  constructor(
    private readonly store: VectorStore,
    private readonly index: PdfChunkIndexRepository,
    private readonly embedder: BatchEmbedder,
    private readonly readPdf: PdfChunkReader,
    private readonly modelId: string,
  ) {}

  /**
   * What indexing these articles would do, so the person can be told before it costs or removes anything. Asks the
   * model for one vector, the only way to know its size, and only when there is something to compare it with.
   *
   * @example const { sizeChanged, othersLosingVectors } = await indexer.plan([1, 2]);
   */
  async plan(articleIds: number[]): Promise<AskIndexPlan> {
    const coverage = this.index.coverage(articleIds, this.modelId);
    const pending = pendingOf(coverage);
    const previousModel = coverage.previousModel ?? this.index.mostUsedModelBesides(this.modelId);
    const same = { pending: pending.length, outdated: coverage.outdated.length, previousModel };
    if (pending.length === 0 || !(await this.sizeChanged())) {
      return { ...same, sizeChanged: false, othersLosingVectors: 0 };
    }
    const othersLosingVectors = this.index.indexedArticlesOutside(pending.map((article) => article.id));
    return { ...same, sizeChanged: true, othersLosingVectors };
  }

  /**
   * Indexes what is pending. `replaceIndex` is the person's answer to the plan: without it a model of another size is
   * refused, keeping the index. With it, the old vectors only leave once the first PDF has its new ones, so a provider
   * that is down costs nothing. `onProgress` hears of each PDF before it is read, so the screen can say how far it got.
   */
  async indexMissing(
    articleIds: number[],
    replaceIndex = false,
    onProgress: (progress: AskIndexProgress) => void = () => undefined,
  ): Promise<AskIndexResult> {
    const pending = pendingOf(this.index.coverage(articleIds, this.modelId));
    if (pending.length > 0 && !replaceIndex) await this.assertSameModelSize();
    const failed: AskIndexResult['failed'] = [];
    for (const [done, article] of pending.entries()) {
      onProgress({ done, total: pending.length, current: article.title });
      const reason = await this.indexOne(article, replaceIndex);
      if (reason) failed.push({ title: article.title, reason });
    }
    onProgress({ done: pending.length, total: pending.length, current: null });
    return { coverage: this.index.coverage(articleIds, this.modelId), failed };
  }

  private async sizeChanged(): Promise<boolean> {
    const indexed = this.store.indexedDimension();
    return indexed !== null && (await this.embedder.embed('dimensão')).length !== indexed;
  }

  private async assertSameModelSize(): Promise<void> {
    const indexed = this.store.indexedDimension();
    if (indexed === null) return;
    assertSameVectorSize(indexed, (await this.embedder.embed('dimensão')).length);
  }

  // One PDF failing (a scan without text, a missing file) must not stop the others: the reason is shown instead.
  private async indexOne(article: ProjectIndexArticle, replaceIndex: boolean): Promise<string | null> {
    try {
      const chunks = await this.readPdf(article.pdfPath ?? '');
      if (chunks.length === 0) return 'O PDF não tem texto para ler; pode ser uma digitalização.';
      const vectors = await this.embedder.embedBatch(chunks.map((chunk) => chunk.text));
      if (replaceIndex) this.store.ensureDimensionAndClearIfMismatched(vectors[0].length);
      this.store.indexArticleChunks(article.id, chunks, vectors, this.modelId);
      return null;
    } catch (err) {
      return errorText(err);
    }
  }
}
