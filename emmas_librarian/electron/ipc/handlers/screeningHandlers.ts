import { IpcChannel, type ScreeningLabelInput, type ScreeningStage } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';

/**
 * Systematic review screening (#49): a project's labels and the decisions on its articles.
 *
 * Usage:
 *   registerScreeningHandlers(ipcMain, db);
 */
export function registerScreeningHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  registerLabelHandlers(ipc, db);
  const decisions = db.screeningDecisionRepo;
  handle(ipc, IpcChannel.SCREENING_DECISIONS_LIST, (_e, projectId: number) => decisions.listDecisions(projectId));
  handle(
    ipc,
    IpcChannel.SCREENING_DECIDE,
    (_e, articleIds: number[], labelId: number, stage: ScreeningStage, note?: string | null) =>
      decisions.decide(articleIds, labelId, stage, note ?? null),
  );
  handle(ipc, IpcChannel.SCREENING_UNDECIDE, (_e, articleIds: number[], stage: ScreeningStage) =>
    decisions.undecide(articleIds, stage),
  );
}

function registerLabelHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  const labels = db.screeningLabelRepo;
  handle(ipc, IpcChannel.SCREENING_LABELS_LIST, (_e, projectId: number) => labels.listLabels(projectId));
  handle(ipc, IpcChannel.SCREENING_LABEL_CREATE, (_e, projectId: number, input: ScreeningLabelInput) =>
    labels.createLabel(projectId, input),
  );
  handle(ipc, IpcChannel.SCREENING_LABEL_RENAME, (_e, labelId: number, name: string) =>
    labels.renameLabel(labelId, name),
  );
  handle(ipc, IpcChannel.SCREENING_LABEL_MOVE, (_e, labelId: number, step: -1 | 1) => labels.moveLabel(labelId, step));
  handle(ipc, IpcChannel.SCREENING_LABEL_DELETE, (_e, labelId: number, moveTo: number | null) =>
    labels.deleteLabel(labelId, moveTo),
  );
  handle(ipc, IpcChannel.SCREENING_PRESET_APPLY, (_e, projectId: number, presetKey: string) =>
    labels.applyPreset(projectId, presetKey),
  );
}
