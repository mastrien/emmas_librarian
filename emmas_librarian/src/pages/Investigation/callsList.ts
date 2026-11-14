import type { CallCell } from './investigationView';

// The "Chamadas" tab as a list (board 161): every call with its number, filtered by outcome and by question.

export type CallFilter = 'all' | 'errors';

/** A call with its number in the investigation, counted from 1. */
export interface NumberedCall {
  number: number;
  call: CallCell;
}

const failed = (call: CallCell) => call.status === 'error' || call.status === 'skipped';

/**
 * The calls that show under a filter and a question ('all' for every question), numbered in the full list.
 *
 * @example visibleCalls(cells, 'errors', 'all').map((c) => c.number) // [3, 7]
 */
export function visibleCalls(cells: CallCell[], filter: CallFilter, question: string): NumberedCall[] {
  return cells
    .map((call, index) => ({ number: index + 1, call }))
    .filter(({ call }) => filter === 'all' || failed(call))
    .filter(({ call }) => question === 'all' || call.question === question);
}

/**
 * How many calls failed, for the "Com erro" filter.
 *
 * @example failedCount(cells) // 4
 */
export const failedCount = (cells: CallCell[]): number => cells.filter(failed).length;

/**
 * The line beside the filters: how many calls and whether they all answered.
 *
 * @example callsSummary(cells) // '36 chamadas · todas responderam'
 */
export function callsSummary(cells: CallCell[]): string {
  const errors = failedCount(cells);
  const total = `${cells.length} ${cells.length === 1 ? 'chamada' : 'chamadas'}`;
  if (errors === 0) return `${total} · todas responderam`;
  return `${total} · ${cells.length - errors} com resposta, ${errors} sem`;
}

/**
 * What "Copiar" puts on the clipboard: the question, the cited passages and the answer or the error.
 *
 * @example callAsText({ number: 1, call }) // 'Chamada 1 — Artigo\nPergunta: …\nTrechos: [pág. 3] …\nResposta: …'
 */
export function callAsText({ number, call }: NumberedCall): string {
  const outcome = call.status === 'success' ? `Resposta: ${call.answer ?? ''}` : `Erro: ${call.error ?? ''}`;
  return [
    `Chamada ${number} — ${call.articleTitle}`,
    `Pergunta: ${call.question}`,
    `Trechos: ${call.evidences.map((e) => (e.page ? `[pág. ${e.page}] ${e.text}` : e.text)).join(' | ') || '—'}`,
    outcome,
  ].join('\n');
}
