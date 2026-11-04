import type { PdfChunkIndexRepository } from '../../database/PdfChunkIndexRepository';
import type { PdfTextChunk } from '../PdfExtractor';
import type { VectorStore } from '../VectorStore';
import type { AskIndexResult, ProjectIndexArticle } from '../../../src/types/ask';
import { assertSameVectorSize, type QuestionEmbedder } from './ProjectQuestionService';

/** Vectors for many texts at once; the app's EmbeddingService is one. */
export interface BatchEmbedder extends QuestionEmbedder {
  embedBatch(texts: string[]): Promise<number[][]>;
}

/** The text of a PDF, in chunks with page and position. */
export type PdfChunkReader = (pdfPath: string) => Promise<PdfTextChunk[]>;

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Indexes the PDFs a question could not read yet. Until now only the massive investigation indexed them, so a project
 * that never ran one had nothing to ask about (#53).
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

  async indexMissing(articleIds: number[]): Promise<AskIndexResult> {
    const missing = this.index.coverage(articleIds, this.modelId).withoutIndex;
    if (missing.length > 0) await this.assertSameModelSize();
    const failed: AskIndexResult['failed'] = [];
    for (const article of missing) {
      const reason = await this.indexOne(article);
      if (reason) failed.push({ title: article.title, reason });
    }
    return { coverage: this.index.coverage(articleIds, this.modelId), failed };
  }

  // Checked ahead because the store clears the whole index when it receives vectors of another size.
  private async assertSameModelSize(): Promise<void> {
    const indexed = this.store.indexedDimension();
    if (indexed === null) return;
    assertSameVectorSize(indexed, (await this.embedder.embed('dimensão')).length);
  }

  // One PDF failing (a scan without text, a missing file) must not stop the others: the reason is shown instead.
  private async indexOne(article: ProjectIndexArticle): Promise<string | null> {
    try {
      const chunks = await this.readPdf(article.pdfPath ?? '');
      if (chunks.length === 0) return 'O PDF não tem texto para ler; pode ser uma digitalização.';
      const vectors = await this.embedder.embedBatch(chunks.map((chunk) => chunk.text));
      this.store.indexArticleChunks(article.id, chunks, vectors, this.modelId);
      return null;
    } catch (err) {
      return errorText(err);
    }
  }
}
