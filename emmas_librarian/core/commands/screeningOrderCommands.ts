import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import {
  ScreeningOrderService,
  type ScreeningOrderSources,
  type TextEmbedder,
} from '../services/screening/ScreeningOrderService';
import { ClassifierEvaluationService } from '../services/screening/ClassifierEvaluationService';
import type { CommandRegistry } from './CommandRegistry';

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
 *   registerScreeningOrderCommands(commands, db, () => ai.askModels());
 */
export function registerScreeningOrderCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  embedding: () => OrderEmbedding,
): void {
  const service = () => {
    const { embedder, modelId } = embedding();
    return new ScreeningOrderService(db.articleVectorRepo, sourcesFrom(db), embedder, modelId);
  };
  commands.add(IpcChannel.SCREENING_ORDER_GET, (projectId: number) => db.articleVectorRepo.isOrderOn(projectId));
  commands.add(IpcChannel.SCREENING_ORDER_SET, (projectId: number, turnedOn: boolean) =>
    db.articleVectorRepo.setOrderOn(projectId, turnedOn),
  );
  commands.add(IpcChannel.SCREENING_VECTORS_PLAN, (projectId: number) => service().plan(projectId));
  commands.add(IpcChannel.SCREENING_VECTORS_GENERATE, (projectId: number) => service().generateNext(projectId));
  commands.add(IpcChannel.SCREENING_RANK, (projectId: number) => service().rank(projectId));
  commands.add(IpcChannel.SCREENING_SIMULATE, (projectId: number) => service().simulate(projectId));
  commands.add(IpcChannel.SCREENING_EVALUATE_CLASSIFIER, (projectId: number) =>
    new ClassifierEvaluationService(
      db.articleVectorRepo,
      db.screeningSuggestionRepo,
      {
        ...sourcesFrom(db),
        labels: (id) => db.screeningLabelRepo.listLabels(id).filter((label) => label.kind !== 'removed'),
        criteria: (id) => db.screeningSuggestionRepo.criteria(id),
      },
      embedding().modelId,
    ).evaluate(projectId),
  );
}
