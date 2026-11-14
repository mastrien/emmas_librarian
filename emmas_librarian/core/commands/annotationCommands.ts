import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { CommandRegistry } from './CommandRegistry';

/**
 * Annotations, highlights (optionally with a linked note) and AI-suggested pending highlights.
 *
 * Usage:
 *   registerAnnotationCommands(commands, db);
 */
export function registerAnnotationCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  commands.add(IpcChannel.ANNOTATIONS_GET, (articleId: number) => db.getAnnotations(articleId));
  commands.add(IpcChannel.ANNOTATIONS_CREATE, (articleId: number, content: string) =>
    db.saveAnnotation(articleId, content),
  );
  commands.add(IpcChannel.ANNOTATIONS_UPDATE, (id: number, content: string) => db.updateAnnotation(id, content));
  commands.add(IpcChannel.ANNOTATIONS_DELETE, (id: number) => db.deleteAnnotation(id));

  commands.add(IpcChannel.HIGHLIGHTS_GET, (articleId: number) => db.getHighlights(articleId));
  commands.add(
    IpcChannel.HIGHLIGHTS_CREATE,
    (articleId: number, color: string, positionData: string, contentText: string | null, note?: string) => {
      const annotationId = note ? db.saveAnnotation(articleId, note) : undefined;
      return db.saveHighlight(articleId, color, positionData, contentText, annotationId);
    },
  );
  commands.add(IpcChannel.HIGHLIGHTS_DELETE, (id: number) => db.deleteHighlight(id));

  commands.add(IpcChannel.PENDING_HIGHLIGHTS_GET, (articleId: number) => db.getPendingHighlights(articleId));
  commands.add(IpcChannel.PENDING_HIGHLIGHTS_DELETE, (id: number) => db.deletePendingHighlight(id));
}
