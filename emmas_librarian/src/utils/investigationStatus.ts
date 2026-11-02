/** What one article of a mass extraction ended with: answers, or the error that stopped it. */
export interface ArticleOutcome {
  error?: string;
}

/** How the status reads at a glance: green, amber or red. */
export type StatusTone = 'success' | 'warning' | 'danger';

export const STATUS_SUCCESS = 'Sucesso';
export const STATUS_FAILED = 'Falhou';
const PARTIAL_PREFIX = 'Concluída com erros';

/**
 * The status saved with a finished run. A run whose every call failed is "Falhou", one with some failures says
 * how many ("Concluída com erros (3 de 8)"): before, a run with a wrong provider was "Sucesso" with every answer
 * an API error (validation of epic #44, 2026-11-01).
 *
 * @example investigationStatus([{}, { error: 'HTTP 401' }]) // 'Concluída com erros (1 de 2)'
 */
export function investigationStatus(outcomes: ArticleOutcome[]): string {
  const failed = outcomes.filter((o) => o.error !== undefined).length;
  if (outcomes.length > 0 && failed === outcomes.length) return STATUS_FAILED;
  if (failed > 0) return `${PARTIAL_PREFIX} (${failed} de ${outcomes.length})`;
  return STATUS_SUCCESS;
}

/**
 * The colour of a status badge: success, a partial run, or anything else (failed, quota, old error texts).
 *
 * @example statusTone('Concluída com erros (1 de 2)') // 'warning'
 */
export function statusTone(status: string | null | undefined): StatusTone {
  if (status === STATUS_SUCCESS) return 'success';
  if (status?.startsWith(PARTIAL_PREFIX)) return 'warning';
  return 'danger';
}

const TONE_COLOURS: Record<StatusTone, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
};

/** The badge background for a status. */
export const statusColour = (status: string | null | undefined): string => TONE_COLOURS[statusTone(status)];
