import type { SearchPreview } from '../../../types';

export interface SearchCounts {
  /** What the bases returned, added up (an article found in 2 bases counts twice). */
  found: number;
  /** Extra copies removed: the same article from more than one base (or twice in one). */
  repeated: number;
  alreadyInProject: number;
  /** What "Salvar" adds: found - repeated - alreadyInProject. */
  added: number;
}

/**
 * The review dialog's numbers, built so they add up: found - repeated - alreadyInProject = added.
 *
 * @example searchCounts(preview) // { found: 5, repeated: 3, alreadyInProject: 1, added: 1 }
 */
export function searchCounts(preview: SearchPreview): SearchCounts {
  const found = Object.values(preview.breakdown).reduce((sum, db) => sum + db.count, 0);
  const unique = preview.results.length;
  const alreadyInProject = preview.results.filter((r) => r.alreadyInProject).length;
  return { found, repeated: found - unique, alreadyInProject, added: unique - alreadyInProject };
}

/**
 * Label of the save button, naming how many articles it adds.
 *
 * @example saveButtonLabel(2) // 'Salvar 2 novos no projeto'
 */
export function saveButtonLabel(added: number): string {
  if (added === 0) return 'Salvar no projeto (nenhum artigo novo)';
  return added === 1 ? 'Salvar 1 novo no projeto' : `Salvar ${added} novos no projeto`;
}
