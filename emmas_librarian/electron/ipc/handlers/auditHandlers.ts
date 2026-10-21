import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { InvestigationAuditRepository } from '../../database/InvestigationAuditRepository';
import type { AuditParams } from '../../../src/utils/auditSampling';
import { handle, type IpcRegistrar } from './handle';

/**
 * Investigation audits by stratified sample (#48): read and save the draw, and list a project's audits.
 *
 * Usage:
 *   registerAuditHandlers(ipcMain, db);
 */
export function registerAuditHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  const audits = new InvestigationAuditRepository(db.getDB());
  handle(ipc, IpcChannel.INVESTIGATION_AUDIT_GET, (_e, investigationId: number) => audits.getAudit(investigationId));
  handle(ipc, IpcChannel.INVESTIGATION_AUDIT_SAVE, (_e, investigationId: number, params: AuditParams) =>
    audits.saveAudit(investigationId, params),
  );
  handle(ipc, IpcChannel.INVESTIGATION_AUDITS_BY_PROJECT, (_e, projectId: number) =>
    audits.getAuditsByProject(projectId),
  );
}
