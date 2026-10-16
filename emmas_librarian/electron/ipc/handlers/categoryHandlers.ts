import fs from 'fs';
import { dialog } from 'electron';
import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { parseCategorySet, validateCategorySetEntries } from '../../../src/utils/categoryTemplates';
import { handle, type IpcRegistrar } from './handle';

type CategoryOptions = Parameters<DatabaseAdapter['createProjectCategory']>[3];

/**
 * Custom article categories and saved massive-investigation runs.
 *
 * Usage:
 *   registerCategoryAndInvestigationHandlers(ipcMain, db);
 */
export function registerCategoryAndInvestigationHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.CATEGORIES_GET_PROJECT, (_e, projectId: number) => db.getProjectCategories(projectId));
  handle(
    ipc,
    IpcChannel.CATEGORIES_CREATE_PROJECT,
    (_e, projectId: number, name: string, type: string, options: CategoryOptions) =>
      db.createProjectCategory(projectId, name, type, options),
  );
  handle(
    ipc,
    IpcChannel.CATEGORIES_UPDATE_PROJECT,
    (_e, categoryId: number, name: string, type: string, options: CategoryOptions) => {
      db.updateProjectCategory(categoryId, name, type, options);
      return true;
    },
  );
  handle(ipc, IpcChannel.CATEGORIES_DELETE_PROJECT, (_e, categoryId: number) => {
    db.deleteProjectCategory(categoryId);
    return true;
  });
  handle(ipc, IpcChannel.CATEGORIES_GET_ARTICLE, (_e, articleId: number) => db.getArticleCategories(articleId));
  handle(ipc, IpcChannel.CATEGORIES_SET_ARTICLE, (_e, articleId: number, categoryId: number, value: string | null) => {
    db.setArticleCategory(articleId, categoryId, value);
    return true;
  });
  handle(ipc, IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE, (_e, projectId: number) =>
    db.getAllProjectArticleCategories(projectId),
  );

  registerCategorySetHandlers(ipc, db);

  handle(ipc, IpcChannel.MASSIVE_INVESTIGATIONS_GET, (_e, projectId: number) => db.getMassiveInvestigations(projectId));
  handle(
    ipc,
    IpcChannel.MASSIVE_INVESTIGATIONS_SAVE,
    (_e, projectId: number, questions: string[], articleIds: number[], modelUsed: string, status: string) =>
      db.saveMassiveInvestigation(projectId, questions, articleIds, modelUsed, status),
  );
}

// #46: templates and the user's own sets (JSON) add categories in one transaction; existing names are skipped.
function registerCategorySetHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.CATEGORIES_APPLY_SET, (_e, projectId: number, entries: unknown) =>
    db.applyCategorySet(projectId, validateCategorySetEntries(entries)),
  );
  handle(ipc, IpcChannel.CATEGORIES_READ_SET_FILE, async () => {
    const file = await chooseCategorySetFile();
    return file ? parseCategorySet(fs.readFileSync(file, 'utf-8')) : null;
  });
}

// E2E runs set E2E_MOCK_OPEN_FILE because Playwright cannot drive native dialogs.
async function chooseCategorySetFile(): Promise<string | null> {
  if (process.env.E2E_MOCK_OPEN_FILE) return process.env.E2E_MOCK_OPEN_FILE;
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Importar conjunto de categorias',
    properties: ['openFile'],
    filters: [{ name: 'Conjunto de categorias (JSON)', extensions: ['json'] }],
  });
  return !canceled && filePaths.length > 0 ? filePaths[0] : null;
}
