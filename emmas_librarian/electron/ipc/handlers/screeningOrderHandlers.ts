import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import {
  ScreeningOrderService,
  type ScreeningOrderSources,
  type TextEmbedder,
} from '../../services/screening/ScreeningOrderService';
import { handle, type IpcRegistrar } from './handle';

/** The embedding model set in the settings. */
export interface OrderEmbedding {
  embedder: TextEmbedder;
  modelId: string;
}

// The title-and-abstract decisions, with what each label means.
function sourcesFrom(db: DatabaseAdapter): ScreeningOrderSources {
  return {
    decided: (projectId) => {
      const labels = new Map(db.screeningLabelRepo.listLabels(projectId).map((label) => [label.id, label.kind]));
      return db.screeningDecisionRepo.listDecisions(projectId).flatMap((decision) => {
        const kind = labels.get(decision.label_id);
        return decision.stage === 'title' && kind ? [{ articleId: decision.article_id, kind }] : [];
      });
    },
  };
}

/**
 * The predicted order of the screening (#55). The model is asked for on each call, since the settings can change.
 *
 * Usage:
 *   registerScreeningOrderHandlers(ipcMain, db, () => ai.askModels());
 */
export function registerScreeningOrderHandlers(
  ipc: IpcRegistrar,
  db: DatabaseAdapter,
  embedding: () => OrderEmbedding,
): void {
  const service = () => {
    const { embedder, modelId } = embedding();
    return new ScreeningOrderService(db.articleVectorRepo, sourcesFrom(db), embedder, modelId);
  };
  handle(ipc, IpcChannel.SCREENING_ORDER_GET, (_e, projectId: number) => db.articleVectorRepo.isOrderOn(projectId));
  handle(ipc, IpcChannel.SCREENING_ORDER_SET, (_e, projectId: number, turnedOn: boolean) =>
    db.articleVectorRepo.setOrderOn(projectId, turnedOn),
  );
  handle(ipc, IpcChannel.SCREENING_VECTORS_PLAN, (_e, projectId: number) => service().plan(projectId));
  handle(ipc, IpcChannel.SCREENING_VECTORS_GENERATE, (_e, projectId: number) => service().generateNext(projectId));
  handle(ipc, IpcChannel.SCREENING_RANK, (_e, projectId: number) => service().rank(projectId));
  handle(ipc, IpcChannel.SCREENING_SIMULATE, (_e, projectId: number) => service().simulate(projectId));
}
