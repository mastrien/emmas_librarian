import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';

/**
 * Annotations, highlights (optionally with a linked note) and AI-suggested pending highlights.
 *
 * Usage:
 *   registerAnnotationHandlers(ipcMain, db);
 */
export function registerAnnotationHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.ANNOTATIONS_GET, (_e, articleId: number) => db.getAnnotations(articleId));
  handle(ipc, IpcChannel.ANNOTATIONS_CREATE, (_e, articleId: number, content: string) => db.saveAnnotation(articleId, content));
  handle(ipc, IpcChannel.ANNOTATIONS_UPDATE, (_e, id: number, content: string) => db.updateAnnotation(id, content));
  handle(ipc, IpcChannel.ANNOTATIONS_DELETE, (_e, id: number) => db.deleteAnnotation(id));

  handle(ipc, IpcChannel.HIGHLIGHTS_GET, (_e, articleId: number) => db.getHighlights(articleId));
  handle(
    ipc,
    IpcChannel.HIGHLIGHTS_CREATE,
    (_e, articleId: number, color: string, positionData: string, contentText: string | null, note?: string) => {
      const annotationId = note ? db.saveAnnotation(articleId, note) : undefined;
      return db.saveHighlight(articleId, color, positionData, contentText, annotationId);
    },
  );
  handle(ipc, IpcChannel.HIGHLIGHTS_DELETE, (_e, id: number) => db.deleteHighlight(id));

  handle(ipc, IpcChannel.PENDING_HIGHLIGHTS_GET, (_e, articleId: number) => db.getPendingHighlights(articleId));
  handle(ipc, IpcChannel.PENDING_HIGHLIGHTS_DELETE, (_e, id: number) => db.deletePendingHighlight(id));
}
