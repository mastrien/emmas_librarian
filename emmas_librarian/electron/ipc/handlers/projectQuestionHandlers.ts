import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { buildAskServices, type AskModels, type AskServices } from '../../services/projectQuestion/askServices';
import type { AskIndexResult, AskQuestionInput } from '../../../src/types/ask';
import { handle, type IpcRegistrar } from './handle';

/**
 * "Perguntar aos projetos" (#53). The models are asked for on each call, because the settings can change between them.
 *
 * Usage:
 *   registerProjectQuestionHandlers(ipcMain, db, () => ai.askModels());
 */
export function registerProjectQuestionHandlers(ipc: IpcRegistrar, db: DatabaseAdapter, models: () => AskModels): void {
  const services = (): AskServices => buildAskServices(db, models());
  const articlesOf = (projectIds: number[]) => db.pdfChunkIndexRepo.projectsArticleIds(projectIds);
  const repo = db.askConversationRepo;

  handle(ipc, IpcChannel.ASK_CONVERSATIONS_LIST, () => repo.list());
  handle(ipc, IpcChannel.ASK_CONVERSATION_GET, (_e, id: number) => services().conversations.read(id));
  handle(ipc, IpcChannel.ASK_SEND, (_e, input: AskQuestionInput) => services().conversations.send(input));
  handle(ipc, IpcChannel.ASK_CONVERSATION_DELETE, (_e, id: number) => repo.remove(id));
  handle(ipc, IpcChannel.ASK_COVERAGE, (_e, projectIds: number[]) =>
    services().questions.coverage(articlesOf(projectIds)),
  );

  // Going back and forth on the page must not index the same PDFs twice: a second call joins the first.
  let running: Promise<AskIndexResult> | null = null;
  handle(ipc, IpcChannel.ASK_INDEX_MISSING, (_e, projectIds: number[]) => {
    running ??= services()
      .indexer.indexMissing(articlesOf(projectIds))
      .finally(() => {
        running = null;
      });
    return running;
  });
}
