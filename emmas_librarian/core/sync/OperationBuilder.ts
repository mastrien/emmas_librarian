import { randomUUID } from 'crypto';
import type { CapturedChange, ChangeKind, ChangeLog } from './ChangeLog';
import type { SyncOperation } from './operations';
import type { RowExporter } from './RowExporter';

/**
 * Turns the raw change log into the operations to send. Several changes to one row become one operation that
 * carries the row as it is now, and a row created and deleted inside the same batch is never sent (the phone
 * never knew it).
 *
 * Usage:
 *   const ops = new OperationBuilder(log, exporter, deviceId).build(log.readSince(ackedSeq));
 */
export class OperationBuilder {
  constructor(
    private readonly log: ChangeLog,
    private readonly exporter: RowExporter,
    private readonly deviceId: string,
  ) {}

  public build(changes: CapturedChange[]): SyncOperation[] {
    const operations: SyncOperation[] = [];
    for (const group of groupByRow(changes)) {
      const operation = this.operationFor(group);
      if (operation) operations.push(operation);
    }
    return operations;
  }

  private operationFor(group: CapturedChange[]): SyncOperation | null {
    const first = group[0];
    const last = group[group.length - 1];
    if (last.kind === 'delete' && first.kind === 'insert') return null;
    const kind: ChangeKind = last.kind === 'delete' ? 'delete' : first.kind === 'insert' ? 'insert' : 'update';
    const localId = this.log.localIdOf(last.entity, last.uuid);
    const fields = kind === 'delete' || localId === undefined ? null : this.exporter.exportRow(last.entity, localId);
    if (kind !== 'delete' && fields === null) return null;
    return {
      opId: randomUUID(),
      deviceId: this.deviceId,
      entity: last.entity,
      uuid: last.uuid,
      kind,
      fields,
      changedAt: last.changedAt,
    };
  }
}

function groupByRow(changes: CapturedChange[]): CapturedChange[][] {
  const groups = new Map<string, CapturedChange[]>();
  for (const change of changes) {
    const key = `${change.entity}:${change.uuid}`;
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }
  return [...groups.values()];
}
