import type { ProjectDocument } from '../../../types';

// The sidebar shows only the quick access links opened most recently (redesign, board 150): a project with many
// links kept them in a long list that pushed everything else away. The full list lives on the project overview.

const ROW_HEIGHT = 28;
const SECTION_CHROME = 2 * ROW_HEIGHT; // the "Acesso rápido" heading and the "Ver todos" link

/**
 * How many links fit in a third of the window, never fewer than 2 nor more than 8.
 *
 * @example quickAccessSlots(800) // 7
 */
export function quickAccessSlots(viewportHeight: number): number {
  const rows = Math.floor((viewportHeight / 3 - SECTION_CHROME) / ROW_HEIGHT);
  return Math.min(8, Math.max(2, rows));
}

const openedAt = (doc: ProjectDocument): number => (doc.last_opened_at ? Date.parse(doc.last_opened_at) : -Infinity);

/**
 * The `limit` links opened most recently; links never opened follow in their manual order.
 *
 * @example recentQuickAccess(docs, 3).map((d) => d.title)
 */
export function recentQuickAccess(documents: ProjectDocument[], limit: number): ProjectDocument[] {
  return [...documents]
    .sort((a, b) => openedAt(b) - openedAt(a) || (a.position ?? 0) - (b.position ?? 0) || a.id - b.id)
    .slice(0, limit);
}
