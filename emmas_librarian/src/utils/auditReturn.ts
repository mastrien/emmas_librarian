/**
 * Where to come back to after opening an evidence from an audit (#48): the project, the investigation and the item.
 * It travels in the router state, like the evidence target the reader already reads (searchQuery, page).
 */
export interface AuditReturn {
  projectId: number;
  investigationId: number;
  resultId: number;
}

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

function asAuditReturn(value: unknown): AuditReturn | null {
  if (!value || typeof value !== 'object') return null;
  const { projectId, investigationId, resultId } = value as Record<string, unknown>;
  return isPositiveInt(projectId) && isPositiveInt(investigationId) && isPositiveInt(resultId)
    ? { projectId, investigationId, resultId }
    : null;
}

/**
 * The router state that opens the reader on an evidence and remembers the audit item to return to.
 *
 * Usage:
 *   navigate(`/articles/${r.article_id}`, { state: readerStateForAudit(evidence, { projectId, investigationId, resultId }) });
 */
export function readerStateForAudit(evidence: { text: string; page?: number }, back: AuditReturn) {
  return { searchQuery: evidence.text, page: evidence.page, returnTo: back };
}

/**
 * The audit to return to, read from the reader's router state; null when the reader was opened another way.
 *
 * Usage:
 *   const back = auditReturnFrom(useLocation().state);
 */
export function auditReturnFrom(state: unknown): AuditReturn | null {
  return state && typeof state === 'object' ? asAuditReturn((state as Record<string, unknown>).returnTo) : null;
}

/**
 * The audit the project page must reopen, read from its router state (set by the reader's "back to the audit").
 *
 * Usage:
 *   const reopen = auditToReopen(useLocation().state);
 */
export function auditToReopen(state: unknown): AuditReturn | null {
  return state && typeof state === 'object' ? asAuditReturn((state as Record<string, unknown>).openAudit) : null;
}
