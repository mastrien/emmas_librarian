import { IpcChannel, type QueryASTNode, type QuerySort } from '../../types';
import { queryTranslator } from '../../services/QueryTranslator';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { SearchOrchestrator } from '../../services/SearchOrchestrator';
import { handle, type IpcRegistrar } from './handle';

/**
 * Projects CRUD, writing pad and search history.
 *
 * Usage:
 *   registerProjectHandlers(ipcMain, db);
 */
export function registerProjectHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.PROJECTS_GET_ALL, () => db.getAllProjects());
  handle(ipc, IpcChannel.PROJECTS_CREATE, (_e, name: string) => createUniquelyNamedProject(db, name));
  handle(ipc, IpcChannel.PROJECTS_GET_ONE, (_e, projectId: number) => db.getProject(projectId));
  handle(ipc, IpcChannel.PROJECTS_GET_WRITING_PAD, (_e, projectId: number) => db.getProjectWritingPad(projectId));
  handle(ipc, IpcChannel.PROJECTS_UPDATE_WRITING_PAD, (_e, projectId: number, content: string) =>
    db.updateProjectWritingPad(projectId, content),
  );
  handle(ipc, IpcChannel.PROJECTS_GET_SEARCH_HISTORY, (_e, projectId: number) => db.getSearchHistory(projectId));
  handle(ipc, IpcChannel.PROJECTS_UPDATE, (_e, id: number, name: string) => db.updateProject(id, name));
  handle(ipc, IpcChannel.PROJECTS_DELETE, (_e, id: number) => db.deleteProject(id));
}

/**
 * Bibliographic search across the external databases, plus query translation and revert.
 *
 * Usage:
 *   registerSearchHandlers(ipcMain, db, orchestrator);
 */
export function registerSearchHandlers(ipc: IpcRegistrar, db: DatabaseAdapter, orchestrator: SearchOrchestrator): void {
  handle(
    ipc,
    IpcChannel.SEARCH_EXECUTE,
    (_e, projectId: number, queryMap: Record<string, string>, limit: number, sortBy: QuerySort, unifiedQuery: string) =>
      process.env.E2E_MOCK_SEARCH === 'true'
        ? persistE2eMockSearch(db, projectId, queryMap, unifiedQuery)
        : orchestrator.searchAndPersist(projectId, queryMap, limit, sortBy, unifiedQuery),
  );
  handle(ipc, IpcChannel.SEARCH_TRANSLATE_QUERY, (_e, ast: QueryASTNode) => queryTranslator.translate(ast));
  handle(ipc, IpcChannel.SEARCH_REVERT, (_e, searchId: number) => db.revertSearch(searchId));
}

function createUniquelyNamedProject(db: DatabaseAdapter, name: string) {
  const normalized = name.trim().toLowerCase();
  if (db.getAllProjects().some((p) => p.name.trim().toLowerCase() === normalized)) {
    throw new Error(
      `[ERR_DUPLICATE_NAME] Já existe um projeto com este nome. Offending value: "${name}". Expected shape: String de nome único entre os projetos cadastrados.`,
    );
  }
  return db.createProject(name);
}

// E2E runs must not hit real bibliographic APIs; persist one canned article instead.
function persistE2eMockSearch(db: DatabaseAdapter, projectId: number, queryMap: Record<string, string>, query: string) {
  const breakdown = { openalex: { count: 1 } };
  const searchId = db.saveSearchHistory(projectId, query || 'E2E mock query', queryMap, 1, breakdown);
  db.saveArticle(projectId, {
    doi: '10.1234/e2e-mock-doi',
    title: 'Aprendizado de Maquina E2E',
    authors: 'Author E2E',
    year: 2026,
    source_query: JSON.stringify(queryMap),
    source_databases: JSON.stringify(['OpenAlex']),
    csl_json: '{}',
    search_id: searchId,
  });
  return { savedCount: 1, breakdown, articles: db.getArticlesByProject(projectId) };
}
