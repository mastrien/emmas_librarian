import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';

type TrashItemType = 'project' | 'article' | 'annotation';

/**
 * Project diary entries with version history, and the trash bin.
 *
 * Usage:
 *   registerDiaryAndTrashHandlers(ipcMain, db);
 */
export function registerDiaryAndTrashHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.DIARY_GET_ALL, (_e, projectId: number) => db.getDiaryEntries(projectId));
  handle(ipc, IpcChannel.DIARY_GET_ONE, (_e, projectId: number, date: string) => db.getDiaryEntry(projectId, date));
  handle(ipc, IpcChannel.DIARY_SAVE, (_e, projectId: number, date: string, content: string) =>
    db.saveDiaryEntry(projectId, date, content),
  );
  handle(ipc, IpcChannel.DIARY_DELETE, (_e, projectId: number, date: string) => db.deleteDiaryEntry(projectId, date));
  handle(ipc, IpcChannel.DIARY_GET_HISTORY, (_e, projectId: number, date: string) => db.getDiaryEntryHistory(projectId, date));
  handle(ipc, IpcChannel.DIARY_RESTORE_VERSION, (_e, versionId: number) => db.restoreDiaryEntryVersion(versionId));

  handle(ipc, IpcChannel.TRASH_GET_ITEMS, () => db.getTrashItems());
  handle(ipc, IpcChannel.TRASH_RESTORE_ITEM, (_e, type: TrashItemType, id: number) => db.restoreTrashItem(type, id));
  handle(ipc, IpcChannel.TRASH_PERMANENT_DELETE, (_e, type: TrashItemType, id: number) => db.deleteTrashItemPermanent(type, id));
  handle(ipc, IpcChannel.TRASH_EMPTY, () => db.emptyTrash());
}
