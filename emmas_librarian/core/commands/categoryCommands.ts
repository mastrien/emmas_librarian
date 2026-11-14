import fs from 'fs';
import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import { parseCategorySet, validateCategorySetEntries } from '../../src/utils/categoryTemplates';
import type { CommandRegistry, FileSuggestion } from './CommandRegistry';

type CategoryOptions = Parameters<DatabaseAdapter['createProjectCategory']>[3];

/**
 * Custom article categories and saved massive-investigation runs.
 *
 * Usage:
 *   registerCategoryAndInvestigationCommands(commands, db);
 */
export function registerCategoryAndInvestigationCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  commands.add(IpcChannel.CATEGORIES_GET_PROJECT, (projectId: number) => db.getProjectCategories(projectId));
  commands.add(
    IpcChannel.CATEGORIES_CREATE_PROJECT,
    (projectId: number, name: string, type: string, options: CategoryOptions) =>
      db.createProjectCategory(projectId, name, type, options),
  );
  commands.add(
    IpcChannel.CATEGORIES_UPDATE_PROJECT,
    (categoryId: number, name: string, type: string, options: CategoryOptions) => {
      db.updateProjectCategory(categoryId, name, type, options);
      return true;
    },
  );
  commands.add(IpcChannel.CATEGORIES_DELETE_PROJECT, (categoryId: number) => {
    db.deleteProjectCategory(categoryId);
    return true;
  });
  commands.add(IpcChannel.CATEGORIES_GET_ARTICLE, (articleId: number) => db.getArticleCategories(articleId));
  commands.add(IpcChannel.CATEGORIES_SET_ARTICLE, (articleId: number, categoryId: number, value: string | null) => {
    db.setArticleCategory(articleId, categoryId, value);
    return true;
  });
  commands.add(IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE, (projectId: number) =>
    db.getAllProjectArticleCategories(projectId),
  );

  registerCategorySetCommands(commands, db);

  commands.add(IpcChannel.MASSIVE_INVESTIGATIONS_GET, (projectId: number) => db.getMassiveInvestigations(projectId));
  commands.add(
    IpcChannel.MASSIVE_INVESTIGATIONS_SAVE,
    (projectId: number, questions: string[], articleIds: number[], modelUsed: string, status: string) =>
      db.saveMassiveInvestigation(projectId, questions, articleIds, modelUsed, status),
  );
}

// #46: templates and the user's own sets (JSON) add categories in one transaction; existing names are skipped.
function registerCategorySetCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  commands.add(IpcChannel.CATEGORIES_APPLY_SET, (projectId: number, entries: unknown) =>
    db.applyCategorySet(projectId, validateCategorySetEntries(entries)),
  );
  commands.add(
    IpcChannel.CATEGORIES_READ_SET_FILE,
    (filePath: string) => parseCategorySet(fs.readFileSync(filePath, 'utf-8')),
    { file: { at: 0, mode: 'open', describe: categorySetFile } },
  );
}

const categorySetFile = (): FileSuggestion => ({
  title: 'Importar conjunto de categorias',
  filters: [{ name: 'Conjunto de categorias (JSON)', extensions: ['json'] }],
});
