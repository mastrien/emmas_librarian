import type { OpenAccessOutcome } from '../../../../types';

/** What a row shows while its open access PDF is being looked for, or what happened. */
export type OpenAccessRowState = { status: 'running' } | OpenAccessOutcome;

export interface OpenAccessMessage {
  tone: 'ok' | 'warning' | 'muted' | 'error';
  text: string;
  /** For a blocked copy: the page to open in the browser and download from there. */
  page?: string;
}

/**
 * The sentence shown for an outcome, in the row and in the batch report.
 *
 * Usage:
 *   openAccessMessage({ status: 'downloaded', source: 'arXiv' }); // { tone: 'ok', text: 'PDF baixado. Fonte: arXiv.' }
 */
export function openAccessMessage(outcome: OpenAccessOutcome): OpenAccessMessage {
  switch (outcome.status) {
    case 'downloaded':
      return { tone: 'ok', text: `PDF baixado. Fonte: ${outcome.source}.` };
    case 'blocked':
      return {
        tone: 'warning',
        text: 'Há cópia aberta, mas o download automático não funcionou.',
        page: outcome.landingPages[0],
      };
    case 'not-open':
      return { tone: 'muted', text: 'Nenhuma cópia aberta conhecida.' };
    case 'no-doi':
      return { tone: 'muted', text: 'Sem DOI para procurar a cópia aberta.' };
    case 'already':
      return { tone: 'muted', text: 'O artigo já tem PDF.' };
    case 'failed':
      return { tone: 'error', text: `Não foi possível procurar: ${outcome.error}` };
  }
}

export interface ReportEntry {
  articleId: number;
  title: string;
  outcome: OpenAccessOutcome;
}

const GROUPS: { label: string; statuses: OpenAccessOutcome['status'][] }[] = [
  { label: 'Baixados', statuses: ['downloaded'] },
  { label: 'Precisam de você', statuses: ['blocked'] },
  { label: 'Falharam', statuses: ['failed'] },
  { label: 'Sem cópia aberta ou sem DOI', statuses: ['not-open', 'no-doi'] },
  { label: 'Já tinham PDF', statuses: ['already'] },
];

/**
 * The batch report's groups, in the order the user should read them, without the empty ones.
 *
 * Usage:
 *   reportGroups(entries); // [{ label: 'Baixados', entries: [...] }, { label: 'Precisam de você', ... }]
 */
export function reportGroups(entries: ReportEntry[]): { label: string; entries: ReportEntry[] }[] {
  return GROUPS.map((g) => ({
    label: g.label,
    entries: entries.filter((e) => g.statuses.includes(e.outcome.status)),
  })).filter((g) => g.entries.length > 0);
}
