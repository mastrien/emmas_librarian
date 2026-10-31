import type { ScreeningKind, ScreeningStage } from '../types';

/** A label a preset creates; `key` finds it again so applying a preset twice creates nothing new. */
export interface PresetLabel {
  key: string;
  name: string;
  kind: ScreeningKind;
}

/**
 * The labels every project starts with (#49). There is always one exclusion label, so excluding never
 * needs a label to be created first, and duplicates have their own kind because PRISMA counts them apart.
 */
export const DEFAULT_LABELS: readonly PresetLabel[] = [
  { key: 'included', name: 'Incluso', kind: 'include' },
  { key: 'maybe', name: 'Em dúvida', kind: 'maybe' },
  { key: 'excluded', name: 'Excluído', kind: 'exclude' },
  { key: 'duplicate', name: 'Duplicado', kind: 'removed' },
];

// PRISMA 2020 asks for the reasons full texts were excluded to be reported but does not fix them: these are
// common ones, meant to be renamed. "Not retrieved" is its own box in the diagram, so it is its own label.
const PRISMA_2020_REASONS: readonly PresetLabel[] = [
  { key: 'prisma2020.not-retrieved', name: 'Texto completo não recuperado', kind: 'exclude' },
  { key: 'prisma2020.population', name: 'População diferente', kind: 'exclude' },
  { key: 'prisma2020.design', name: 'Desenho de estudo não elegível', kind: 'exclude' },
  { key: 'prisma2020.outcome', name: 'Desfecho não relatado', kind: 'exclude' },
];

/** Presets offered in the labels window, by key. */
export const SCREENING_PRESETS: Readonly<Record<string, readonly PresetLabel[]>> = {
  prisma2020: [...DEFAULT_LABELS, ...PRISMA_2020_REASONS],
};

/** The kinds a person can pick at each stage; duplicates are spotted while reading titles, not full texts. */
export const KINDS_BY_STAGE: Readonly<Record<ScreeningStage, readonly ScreeningKind[]>> = {
  title: ['include', 'maybe', 'exclude', 'removed'],
  full: ['include', 'maybe', 'exclude'],
};

/** True for the kinds that take the article out of the review and archive it in the project. */
export const isOutKind = (kind: ScreeningKind): boolean => kind === 'exclude' || kind === 'removed';

/**
 * The archive note a triage exclusion writes on the article: the label name, then the person's note.
 *
 * @example archiveNoteFor('Fora do escopo', 'só radar') // 'Fora do escopo · só radar'
 */
export function archiveNoteFor(labelName: string, note: string | null): string {
  return note ? `${labelName} · ${note}` : labelName;
}
