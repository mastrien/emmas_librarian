import { IpcChannel, type ScreeningLabelInput, type ScreeningStage } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { CommandRegistry } from './CommandRegistry';

/**
 * Systematic review screening (#49): a project's labels and the decisions on its articles.
 *
 * Usage:
 *   registerScreeningCommands(commands, db);
 */
export function registerScreeningCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  registerLabelCommands(commands, db);
  const decisions = db.screeningDecisionRepo;
  commands.add(IpcChannel.SCREENING_DECISIONS_LIST, (projectId: number) => decisions.listDecisions(projectId));
  commands.add(
    IpcChannel.SCREENING_DECIDE,
    (articleIds: number[], labelId: number, stage: ScreeningStage, note?: string | null) =>
      decisions.decide(articleIds, labelId, stage, note ?? null),
  );
  commands.add(IpcChannel.SCREENING_UNDECIDE, (articleIds: number[], stage: ScreeningStage) =>
    decisions.undecide(articleIds, stage),
  );
}

function registerLabelCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  const labels = db.screeningLabelRepo;
  commands.add(IpcChannel.SCREENING_LABELS_LIST, (projectId: number) => labels.listLabels(projectId));
  commands.add(IpcChannel.SCREENING_LABEL_CREATE, (projectId: number, input: ScreeningLabelInput) =>
    labels.createLabel(projectId, input),
  );
  commands.add(IpcChannel.SCREENING_LABEL_RENAME, (labelId: number, name: string) => labels.renameLabel(labelId, name));
  commands.add(IpcChannel.SCREENING_LABEL_MOVE, (labelId: number, step: -1 | 1) => labels.moveLabel(labelId, step));
  commands.add(IpcChannel.SCREENING_LABEL_DELETE, (labelId: number, moveTo: number | null) =>
    labels.deleteLabel(labelId, moveTo),
  );
  commands.add(IpcChannel.SCREENING_PRESET_APPLY, (projectId: number, presetKey: string) =>
    labels.applyPreset(projectId, presetKey),
  );
}
