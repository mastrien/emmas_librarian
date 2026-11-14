import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { CommandRegistry } from './CommandRegistry';

type TrashItemType = 'project' | 'article' | 'annotation';

/**
 * Project diary entries with version history, and the trash bin.
 *
 * Usage:
 *   registerDiaryAndTrashCommands(commands, db);
 */
export function registerDiaryAndTrashCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  commands.add(IpcChannel.DIARY_GET_ALL, (projectId: number) => db.getDiaryEntries(projectId));
  commands.add(IpcChannel.DIARY_GET_ONE, (projectId: number, date: string) => db.getDiaryEntry(projectId, date));
  commands.add(IpcChannel.DIARY_SAVE, (projectId: number, date: string, content: string, expected?: string | null) =>
    db.saveDiaryEntry(projectId, date, content, expected),
  );
  commands.add(IpcChannel.DIARY_DELETE, (projectId: number, date: string) => db.deleteDiaryEntry(projectId, date));
  commands.add(IpcChannel.DIARY_GET_HISTORY, (projectId: number, date: string) =>
    db.getDiaryEntryHistory(projectId, date),
  );
  commands.add(IpcChannel.DIARY_RESTORE_VERSION, (versionId: number) => db.restoreDiaryEntryVersion(versionId));

  commands.add(IpcChannel.TRASH_GET_ITEMS, () => db.getTrashItems());
  commands.add(IpcChannel.TRASH_RESTORE_ITEM, (type: TrashItemType, id: number) => db.restoreTrashItem(type, id));
  commands.add(IpcChannel.TRASH_PERMANENT_DELETE, (type: TrashItemType, id: number) =>
    db.deleteTrashItemPermanent(type, id),
  );
  commands.add(IpcChannel.TRASH_EMPTY, () => db.emptyTrash());
}
