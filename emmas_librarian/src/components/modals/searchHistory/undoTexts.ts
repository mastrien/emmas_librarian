import type { SearchHistoryItem } from '../../../types';
import { isOutsideSearchEntry } from '../../../utils/outsideSearchEntries';

/** What the undo button of a history entry says, and what it asks before removing the entry's articles. */
export interface UndoTexts {
  label: string;
  title: string;
  confirm: string;
}

const SEARCH: UndoTexts = {
  label: 'Desfazer Busca',
  title: 'Desfazer busca (remover artigos importados)',
  confirm: 'Deseja realmente desfazer esta busca? Todos os artigos importados por ela serão removidos permanentemente.',
};

// PRISMA 2020 reads a removed record as one that was never identified; a considered one must be excluded (#67).
const OUTSIDE: UndoTexts = {
  label: 'Desfazer inclusão',
  title: 'Desfazer inclusão (remover os artigos que ela trouxe)',
  confirm: [
    'Deseja realmente desfazer esta inclusão? Os artigos que ela trouxe serão removidos permanentemente.',
    'Atenção (PRISMA): remover um artigo significa que ele entrou por engano e nunca foi identificado pela revisão. Se ele foi considerado e descartado, arquive-o ou exclua-o na triagem, para o diagrama PRISMA registrar a exclusão.',
  ].join('\n\n'),
};

/**
 * The undo texts of a history entry: a structured search keeps the usual ones; an entry that brought articles
 * from outside the searches (added by hand, a PDF batch, a copy from another project) warns about PRISMA.
 *
 * @example undoTexts(entry).confirm // 'Deseja realmente desfazer esta inclusão? …'
 */
export function undoTexts(entry: Pick<SearchHistoryItem, 'results_breakdown'>): UndoTexts {
  return isOutsideSearchEntry(entry) ? OUTSIDE : SEARCH;
}
