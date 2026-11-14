import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../../core/database/DatabaseAdapter';
import { buildAskServices, type AskModels, type AskServices } from '../../../core/services/projectQuestion/askServices';
import type { AskIndexProgress, AskIndexResult, AskIndexTarget, AskQuestionInput } from '../../../src/types/ask';
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
  const articlesIn = (target: AskIndexTarget) =>
    'articleIds' in target ? target.articleIds : articlesOf(target.projectIds);
  const repo = db.askConversationRepo;

  handle(ipc, IpcChannel.ASK_CONVERSATIONS_LIST, () => repo.list());
  handle(ipc, IpcChannel.ASK_CONVERSATION_GET, (_e, id: number) => services().conversations.read(id));
  handle(ipc, IpcChannel.ASK_SEND, (_e, input: AskQuestionInput) => services().conversations.send(input));
  handle(ipc, IpcChannel.ASK_CONVERSATION_DELETE, (_e, id: number) => repo.remove(id));
  handle(ipc, IpcChannel.ASK_COVERAGE, (_e, projectIds: number[]) =>
    services().questions.coverage(articlesOf(projectIds)),
  );

  handle(ipc, IpcChannel.ASK_INDEX_PLAN, (_e, target: AskIndexTarget) => services().indexer.plan(articlesIn(target)));

  // Going back and forth on the page must not index the same PDFs twice: a second call joins the first.
  let running: Promise<AskIndexResult> | null = null;
  // The indexing runs in one call; the screen asks how far it got while waiting (validation of epic #44).
  let progress: AskIndexProgress | null = null;
  handle(ipc, IpcChannel.ASK_INDEX_MISSING, (_e, target: AskIndexTarget, replaceIndex = false) => {
    running ??= services()
      .indexer.indexMissing(articlesIn(target), replaceIndex === true, (now) => {
        progress = now;
      })
      .finally(() => {
        running = null;
        progress = null;
      });
    return running;
  });
  handle(ipc, IpcChannel.ASK_INDEX_PROGRESS, () => progress);
}
