import type { ProjectDocument } from '../../../types';

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
