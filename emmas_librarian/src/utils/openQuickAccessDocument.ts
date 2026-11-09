import type { IProjectService } from '../services/ProjectServiceInterface';
import type { ProjectDocument } from '../types';

/**
 * Opens a quick access link outside the app and records the visit, which orders the recent links in the
 * project sidebar. The visit is recorded even if the link fails to open: the user did reach for it.
 *
 * @example await openQuickAccessDocument(projectService, doc);
 */
export async function openQuickAccessDocument(service: IProjectService, doc: ProjectDocument): Promise<void> {
  await service.markProjectDocumentOpened(doc.id);
  await service.openProjectDocumentExternal(doc.url, doc.local_file_path);
}
