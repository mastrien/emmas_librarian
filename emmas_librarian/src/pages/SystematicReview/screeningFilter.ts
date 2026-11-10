import type { ScreeningKind, ScreeningLabel } from '../../types';
import type { ReviewCounts } from '../../utils/screeningView';

// The screening list shows one status at a time (board 164), in place of every section stacked on the page.

export type ScreeningFilter = 'pending' | ScreeningKind;

export const SCREENING_FILTERS: readonly { id: ScreeningFilter; label: string }[] = [
  { id: 'pending', label: 'Sem decisão' },
  { id: 'include', label: 'Incluídos' },
  { id: 'maybe', label: 'Em dúvida' },
  { id: 'exclude', label: 'Excluídos' },
  { id: 'removed', label: 'Removidos antes' },
];

/**
 * How many articles a filter shows. The articles archived on the project page without a label are listed with the
 * exclusions, so they count there.
 *
 * @example filterCount(counts, 'exclude') // counts.exclude + counts.unlabeled
 */
export function filterCount(counts: ReviewCounts, filter: ScreeningFilter): number {
  if (filter === 'exclude') return counts.exclude + counts.unlabeled;
  return counts[filter];
}

/**
 * Where the list opens: what still waits for a decision, or the included ones once nothing does.
 *
 * @example defaultFilter({ pending: 0, … }) // 'include'
 */
export function defaultFilter(counts: ReviewCounts): ScreeningFilter {
  return counts.pending > 0 ? 'pending' : 'include';
}

/** The one-click decisions of a pending row (board 164): the first label of each kind. */
export type QuickKind = 'include' | 'maybe' | 'exclude';

export const QUICK_KINDS: readonly { kind: QuickKind; label: string }[] = [
  { kind: 'include', label: 'Incluir' },
  { kind: 'maybe', label: 'Dúvida' },
  { kind: 'exclude', label: 'Excluir' },
];

/**
 * The label a quick decision uses: the first one of that kind, as the presets create them ("Incluso", "Em dúvida",
 * "Excluído"); none when the project has no label of that kind.
 *
 * @example quickLabel(labels, 'exclude')?.name // 'Excluído'
 */
export function quickLabel(labels: ScreeningLabel[], kind: QuickKind): ScreeningLabel | undefined {
  return labels.find((label) => label.kind === kind);
}
