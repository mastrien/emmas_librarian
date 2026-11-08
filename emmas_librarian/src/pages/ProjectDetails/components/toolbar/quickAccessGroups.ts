import type { ProjectDocument } from '../../../../types';

/**
 * The quick-access documents grouped by their category (trimmed), the uncategorised group first and the others in
 * the order they first appear.
 *
 * @example groupByCategory(docs) // [['', [doc1]], ['WORCAP', [doc2, doc3]]]
 */
export function groupByCategory(documents: ProjectDocument[]): [string, ProjectDocument[]][] {
  const groups = new Map<string, ProjectDocument[]>();
  for (const doc of documents) {
    const key = doc.category?.trim() || '';
    groups.set(key, [...(groups.get(key) ?? []), doc]);
  }
  const entries = [...groups.entries()];
  return [...entries.filter(([name]) => name === ''), ...entries.filter(([name]) => name !== '')];
}
