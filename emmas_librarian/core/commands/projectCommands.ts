import { IpcChannel, type QueryASTNode, type QuerySort } from '../../src/types';
import type { CitationRequest, CitationSeed } from '../../src/types';
import { queryTranslator } from '../services/QueryTranslator';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { SearchOrchestrator } from '../services/SearchOrchestrator';
import { AppError } from '../errors/AppError';
import type { CommandRegistry } from './CommandRegistry';
import type { SearchLimits } from '../../src/utils/searchLimits';

/**
 * Projects CRUD, writing pad and search history.
 *
 * Usage:
 *   registerProjectCommands(commands, db);
 */
export function registerProjectCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  commands.add(IpcChannel.PROJECTS_GET_ALL, () => db.getAllProjects());
  commands.add(IpcChannel.PROJECTS_CREATE, (name: string) => createUniquelyNamedProject(db, name));
  commands.add(IpcChannel.PROJECTS_GET_ONE, (projectId: number) => db.getProject(projectId));
  commands.add(IpcChannel.PROJECTS_GET_ABOUT, (projectId: number) => db.getProjectAbout(projectId));
  commands.add(IpcChannel.PROJECTS_UPDATE_ABOUT, (projectId: number, markdown: string) =>
    db.updateProjectAbout(projectId, markdown),
  );
  commands.add(IpcChannel.PROJECTS_GET_NAV_COUNTS, (projectId: number) => db.getProjectNavCounts(projectId));
  commands.add(IpcChannel.PROJECTS_MARK_OPENED, (projectId: number) => db.markProjectOpened(projectId));
  commands.add(IpcChannel.PROJECTS_GET_SCREENING_SUMMARIES, () => db.getScreeningSummaries());
  commands.add(IpcChannel.PROJECTS_GET_WRITING_PAD, (projectId: number) => db.getProjectWritingPad(projectId));
  commands.add(IpcChannel.PROJECTS_UPDATE_WRITING_PAD, (projectId: number, content: string) =>
    db.updateProjectWritingPad(projectId, content),
  );
  commands.add(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, (projectId: number) => db.getSearchHistory(projectId));
  commands.add(IpcChannel.PROJECTS_UPDATE, (id: number, name: string) => db.updateProject(id, name));
  commands.add(IpcChannel.PROJECTS_DELETE, (id: number) => db.deleteProject(id));
}

/**
 * Bibliographic search across the external databases (preview, then save or discard), plus query
 * translation and revert.
 *
 * Usage:
 *   registerSearchCommands(commands, db, orchestrator);
 */
export function registerSearchCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  orchestrator: SearchOrchestrator,
): void {
  commands.add(
    IpcChannel.SEARCH_PREVIEW,
    (
      projectId: number,
      queryMap: Record<string, string>,
      limits: SearchLimits,
      sortBy: QuerySort,
      unifiedQuery: string,
      queryState?: string,
    ) => orchestrator.preview(projectId, queryMap, limits, sortBy, unifiedQuery, queryState),
  );
  commands.add(IpcChannel.SEARCH_SAVE_PREVIEW, (previewId: string) => orchestrator.savePreview(previewId));
  commands.add(IpcChannel.SEARCH_PEEK_CITATIONS, (seeds: CitationSeed[]) => orchestrator.peekCitations(seeds));
  commands.add(IpcChannel.SEARCH_PREVIEW_CITATIONS, (projectId: number, request: CitationRequest) =>
    orchestrator.previewCitations(projectId, request),
  );
  commands.add(IpcChannel.SEARCH_DISCARD_PREVIEW, (previewId: string) => orchestrator.discardPreview(previewId));
  commands.add(IpcChannel.SEARCH_TRANSLATE_QUERY, (ast: QueryASTNode) => queryTranslator.translate(ast));
  commands.add(IpcChannel.SEARCH_REVERT, (searchId: number) => db.revertSearch(searchId));
}

function createUniquelyNamedProject(db: DatabaseAdapter, name: string) {
  const normalized = name.trim().toLowerCase();
  if (db.getAllProjects().some((p) => p.name.trim().toLowerCase() === normalized)) {
    throw new AppError(
      'ERR_DUPLICATE_NAME',
      'USER_ERROR',
      `[ERR_DUPLICATE_NAME] Já existe um projeto com este nome. Offending value: "${name}". Expected shape: String de nome único entre os projetos cadastrados.`,
    );
  }
  return db.createProject(name);
}
