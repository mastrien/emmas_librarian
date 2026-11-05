import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { LlmScreeningEngine, type ScreeningCompletion } from '../../services/screening/ScreeningEngine';
import {
  ScreeningSuggestionService,
  type SuggestionSources,
} from '../../services/screening/ScreeningSuggestionService';
import type { ScreeningCriteria, ScreeningEngineInfo } from '../../../src/types/screeningSuggestion';
import { handle, type IpcRegistrar } from './handle';

/** The model that answers suggestions; AIService gives the configured one. */
export interface ScreeningModel {
  complete: ScreeningCompletion;
  modelId: string;
}

// A suggestion is about title and abstract, so it offers the labels of that stage; duplicates are not its call.
function sourcesFrom(db: DatabaseAdapter): SuggestionSources {
  return {
    article: (articleId) => {
      const article = db.getArticle(articleId);
      if (!article) return null;
      return {
        id: article.id,
        projectId: article.project_id,
        title: article.title,
        abstract: article.abstract ?? '',
        year: article.year ?? null,
      };
    },
    labels: (projectId) => db.screeningLabelRepo.listLabels(projectId).filter((label) => label.kind !== 'removed'),
  };
}

const engineInfo = (modelId: string): ScreeningEngineInfo => ({ id: modelId, provider: modelId.split('/')[0] });

/**
 * Screening suggestions (#54). The model is asked for on each call, because the settings can change between them.
 *
 * Usage:
 *   registerScreeningSuggestionHandlers(ipcMain, db, () => ai.screeningModel());
 */
export function registerScreeningSuggestionHandlers(
  ipc: IpcRegistrar,
  db: DatabaseAdapter,
  model: () => ScreeningModel,
): void {
  const repo = db.screeningSuggestionRepo;
  handle(ipc, IpcChannel.SCREENING_CRITERIA_GET, (_e, projectId: number) => repo.criteria(projectId));
  handle(ipc, IpcChannel.SCREENING_CRITERIA_SAVE, (_e, projectId: number, criteria: ScreeningCriteria) =>
    repo.saveCriteria(projectId, criteria),
  );
  handle(ipc, IpcChannel.SCREENING_SUGGESTIONS_LIST, (_e, projectId: number) => repo.listForProject(projectId));
  handle(ipc, IpcChannel.SCREENING_ENGINE, () => engineInfo(model().modelId));
  handle(ipc, IpcChannel.SCREENING_SUGGEST, (_e, articleId: number) => {
    const { complete, modelId } = model();
    const engine = new LlmScreeningEngine(complete, modelId);
    return new ScreeningSuggestionService(repo, sourcesFrom(db), engine).suggest(articleId);
  });
}
