import type { SearchHistoryItem } from '../../../types';
import { isOutsideSearchEntry } from '../../../utils/outsideSearchEntries';
import { databaseLabel } from '../searchSummary/SearchBreakdownList';
import { parseStoredObject } from './historyDetails';

// One line of the history list (redesign, board 157): what the entry is, when, through which bases, how many saved.

/**
 * "Busca #12" for a search; an import or a manual addition is named by what it recorded.
 *
 * @example historyEntryTitle({ id: 12, unified_query: 'radar', results_breakdown: '{"scopus":{}}' } as SearchHistoryItem) // 'Busca #12'
 */
export function historyEntryTitle(item: Pick<SearchHistoryItem, 'id' | 'unified_query' | 'results_breakdown'>): string {
  return isOutsideSearchEntry(item) ? item.unified_query || `Inclusão #${item.id}` : `Busca #${item.id}`;
}

/**
 * The bases that answered, by name.
 *
 * @example historyBasesLine({ results_breakdown: '{"scopus":{},"openalex":{}}' } as SearchHistoryItem) // 'Scopus · OpenAlex'
 */
export function historyBasesLine(item: Pick<SearchHistoryItem, 'results_breakdown'>): string {
  return Object.keys(parseStoredObject<Record<string, unknown>>(item.results_breakdown)).map(databaseLabel).join(' · ');
}

/**
 * "07/08 14:58": day and time, enough to tell the entries of a project apart.
 *
 * @example historyWhen('2026-08-07T14:58:00') // '07/08 14:58'
 */
export function historyWhen(createdAt: string): string {
  const date = new Date(createdAt);
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}
