import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import { LlmScreeningEngine, type ScreeningModel } from '../services/screening/ScreeningEngine';
import { ScreeningSuggestionService, type SuggestionSources } from '../services/screening/ScreeningSuggestionService';
import type { ScreeningCriteria, ScreeningEngineInfo } from '../../src/types/screeningSuggestion';
import type { CommandRegistry } from './CommandRegistry';

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
 *   registerScreeningSuggestionCommands(commands, db, () => ai.screeningModel());
 */
export function registerScreeningSuggestionCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  model: () => ScreeningModel,
): void {
  const repo = db.screeningSuggestionRepo;
  commands.add(IpcChannel.SCREENING_CRITERIA_GET, (projectId: number) => repo.criteria(projectId));
  commands.add(IpcChannel.SCREENING_CRITERIA_SAVE, (projectId: number, criteria: ScreeningCriteria) =>
    repo.saveCriteria(projectId, criteria),
  );
  commands.add(IpcChannel.SCREENING_SUGGESTIONS_LIST, (projectId: number) => repo.listForProject(projectId));
  commands.add(IpcChannel.SCREENING_ENGINE, () => engineInfo(model().modelId));
  commands.add(IpcChannel.SCREENING_SUGGEST, (articleId: number) => {
    const { complete, modelId } = model();
    const engine = new LlmScreeningEngine(complete, modelId);
    return new ScreeningSuggestionService(repo, sourcesFrom(db), engine).suggest(articleId);
  });
}
