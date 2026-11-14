import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import { InvestigationAuditRepository } from '../database/InvestigationAuditRepository';
import type { AuditParams } from '../../src/utils/auditSampling';
import type { CommandRegistry } from './CommandRegistry';

/**
 * Investigation audits by stratified sample (#48): read and save the draw, and list a project's audits.
 *
 * Usage:
 *   registerAuditCommands(commands, db);
 */
export function registerAuditCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  const audits = new InvestigationAuditRepository(db.getDB());
  commands.add(IpcChannel.INVESTIGATION_AUDIT_GET, (investigationId: number) => audits.getAudit(investigationId));
  commands.add(IpcChannel.INVESTIGATION_AUDIT_SAVE, (investigationId: number, params: AuditParams) =>
    audits.saveAudit(investigationId, params),
  );
  commands.add(IpcChannel.INVESTIGATION_AUDITS_BY_PROJECT, (projectId: number) => audits.getAuditsByProject(projectId));
}
