import type { ProjectDocument } from '../../../types';
import { reorderedItems } from './documentReorder';

export interface DocumentGroup {
  /** The group's name; null for the documents that have none. */
  name: string | null;
  documents: ProjectDocument[];
}

/**
 * The quick access documents gathered by their category, the groups in the order each first appears. The ones with no
 * category come first, with no name (board 178).
 *
 * @example groupDocuments([a('Ferramentas'), b('Reuniões'), c('Ferramentas')]) // [{ name: 'Ferramentas', documents: [a, c] }, …]
 */
export function groupDocuments(documents: ProjectDocument[]): DocumentGroup[] {
  const groups = new Map<string | null, ProjectDocument[]>();
  for (const doc of documents) {
    const name = doc.category?.trim() || null;
    groups.set(name, [...(groups.get(name) ?? []), doc]);
  }
  const named = [...groups].filter(([name]) => name !== null);
  const unnamed = groups.get(null);
  return [...(unnamed ? [[null, unnamed] as const] : []), ...named].map(([name, docs]) => ({ name, documents: docs }));
}

/**
 * The documents in the order the groups show them, which is the order a drag reorders.
 *
 * @example inGroupOrder([a('X'), b('Y'), c('X')]).map((d) => d.id) // [a, c, b]
 */
export const inGroupOrder = (documents: ProjectDocument[]): ProjectDocument[] =>
  groupDocuments(documents).flatMap((group) => group.documents);

/**
 * The documents after a drag, or null when the drag changes nothing or cannot be shown: the list is drawn by group, so
 * a document dropped in the middle of another group would be saved there and drawn back in its own (review of PR #187).
 * Dragging inside a group, or to the edge between two groups, is kept.
 *
 * @example reorderedInGroups(inGroupOrder(docs), 0, 2) // the first document moved down inside its group
 */
export function reorderedInGroups(
  ordered: ProjectDocument[],
  sourceIndex: number,
  dropIndex: number | null,
): ProjectDocument[] | null {
  const updated = reorderedItems(ordered, sourceIndex, dropIndex);
  if (!updated) return null;
  const drawn = inGroupOrder(updated);
  return drawn.every((d, i) => d.id === updated[i].id) ? updated : null;
}
