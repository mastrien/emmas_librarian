import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { AIService } from '../../services/AIService';
import { handle, type IpcRegistrar } from './handle';

/**
 * Asking a question across the articles of a project (#53).
 *
 * Usage:
 *   registerProjectQuestionHandlers(ipcMain, db, aiService);
 */
export function registerProjectQuestionHandlers(ipc: IpcRegistrar, db: DatabaseAdapter, ai: AIService): void {
  const articlesOf = (projectId: number) => db.pdfChunkIndexRepo.projectArticleIds(projectId);
  handle(ipc, IpcChannel.AI_PROJECT_INDEX_COVERAGE, (_e, projectId: number) =>
    ai.projectIndexCoverage(articlesOf(projectId)),
  );
  handle(ipc, IpcChannel.AI_ASK_PROJECT, (_e, projectId: number, question: string) =>
    ai.askProject(question, articlesOf(projectId)),
  );
}
