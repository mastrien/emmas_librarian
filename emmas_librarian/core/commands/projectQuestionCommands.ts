import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import { buildAskServices, type AskModels, type AskServices } from '../services/projectQuestion/askServices';
import type { AskIndexProgress, AskIndexResult, AskIndexTarget, AskQuestionInput } from '../../src/types/ask';
import type { CommandRegistry } from './CommandRegistry';

/**
 * "Perguntar aos projetos" (#53). The models are asked for on each call, because the settings can change between them.
 *
 * Usage:
 *   registerProjectQuestionCommands(commands, db, () => ai.askModels());
 */
export function registerProjectQuestionCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  models: () => AskModels,
): void {
  const services = (): AskServices => buildAskServices(db, models());
  const articlesOf = (projectIds: number[]) => db.pdfChunkIndexRepo.projectsArticleIds(projectIds);
  const articlesIn = (target: AskIndexTarget) =>
    'articleIds' in target ? target.articleIds : articlesOf(target.projectIds);
  const repo = db.askConversationRepo;

  commands.add(IpcChannel.ASK_CONVERSATIONS_LIST, () => repo.list());
  commands.add(IpcChannel.ASK_CONVERSATION_GET, (id: number) => services().conversations.read(id));
  commands.add(IpcChannel.ASK_SEND, (input: AskQuestionInput) => services().conversations.send(input));
  commands.add(IpcChannel.ASK_CONVERSATION_DELETE, (id: number) => repo.remove(id));
  commands.add(IpcChannel.ASK_COVERAGE, (projectIds: number[]) =>
    services().questions.coverage(articlesOf(projectIds)),
  );

  commands.add(IpcChannel.ASK_INDEX_PLAN, (target: AskIndexTarget) => services().indexer.plan(articlesIn(target)));

  // Going back and forth on the page must not index the same PDFs twice: a second call joins the first.
  let running: Promise<AskIndexResult> | null = null;
  // The indexing runs in one call; the screen asks how far it got while waiting (validation of epic #44).
  let progress: AskIndexProgress | null = null;
  commands.add(IpcChannel.ASK_INDEX_MISSING, (target: AskIndexTarget, replaceIndex = false) => {
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
  commands.add(IpcChannel.ASK_INDEX_PROGRESS, () => progress);
}
