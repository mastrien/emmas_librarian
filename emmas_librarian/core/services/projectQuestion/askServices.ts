import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { extractTextWithCoordinates } from '../PdfExtractor';
import { VectorStore } from '../VectorStore';
import { AskConversationService } from './AskConversationService';
import { ProjectIndexer, type BatchEmbedder, type PdfChunkReader } from './ProjectIndexer';
import { ProjectQuestionService, type AnswerCompletion } from './ProjectQuestionService';

/** The parts that talk to AI providers: the rest of "Perguntar aos projetos" does not depend on which they are. */
export interface AskModels {
  embedder: BatchEmbedder;
  complete: AnswerCompletion;
  modelId: string;
}

export interface AskServices {
  conversations: AskConversationService;
  questions: ProjectQuestionService;
  indexer: ProjectIndexer;
}

/**
 * The PDF chunks, cut as the massive investigation cuts them, so both read the same index.
 *
 * @example const chunks = await pdfChunkReader(db)('/pdfs/a.pdf');
 */
export function pdfChunkReader(db: DatabaseAdapter): PdfChunkReader {
  return async (pdfPath) => {
    const size = parseInt(db.getSetting('rag_chunk_size') || '1000', 10);
    const overlap = parseInt(db.getSetting('rag_chunk_overlap') || '200', 10);
    return (await extractTextWithCoordinates(pdfPath, size, overlap)).chunks;
  };
}

/**
 * Puts together what the "Perguntar aos projetos" handlers use.
 *
 * @example buildAskServices(db, ai.askModels()).conversations.read(1);
 */
export function buildAskServices(
  db: DatabaseAdapter,
  models: AskModels,
  readPdf: PdfChunkReader = pdfChunkReader(db),
): AskServices {
  const store = new VectorStore(db.getDB());
  const index = db.pdfChunkIndexRepo;
  const questions = new ProjectQuestionService(store, index, models.embedder, models.complete, models.modelId);
  return {
    questions,
    conversations: new AskConversationService(db.askConversationRepo, index, questions),
    indexer: new ProjectIndexer(store, index, models.embedder, readPdf, models.modelId),
  };
}
