import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
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

  handle(ipc, IpcChannel.MASSIVE_INVESTIGATIONS_GET, (_e, projectId: number) => db.getMassiveInvestigations(projectId));
  handle(
    ipc,
    IpcChannel.MASSIVE_INVESTIGATIONS_SAVE,
    (_e, projectId: number, questions: string[], articleIds: number[], modelUsed: string, status: string) =>
      db.saveMassiveInvestigation(projectId, questions, articleIds, modelUsed, status),
  );
}
