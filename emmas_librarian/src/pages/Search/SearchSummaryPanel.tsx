import React from 'react';
import { Loader2, Search } from 'lucide-react';
import type { QueryTranslationResult } from '../../types';
import { SEARCH_DATABASES } from './searchQueries';
import { QueryTranslationCard } from './QueryTranslationCard';

interface SearchSummaryPanelProps {
  /** The query in words, as describeQueryTree writes it. */
  readableQuery: string;
  selected: string[];
  translations: Record<string, QueryTranslationResult | undefined>;
  customQueries: Record<string, string | undefined>;
  onCustomQueryChange: (dbId: string, query: string | undefined) => void;
  maxResults: number;
  loading: boolean;
  disabled: boolean;
  error: string | null;
}

const Tile: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="search-tile">
    <span className="search-label">{label}</span>
    <span className="search-tile__value">{value}</span>
    {note && <span className="search-tile__note">{note}</span>}
  </div>
);

/**
 * "Antes de buscar" (board 158): what will be asked, how each chosen base receives it (editable), how many bases and
 * up to how many results, then the one primary action, "Fazer busca" (Ctrl+Enter). It submits the page's form.
 *
 * @example <SearchSummaryPanel readableQuery={q} selected={['openalex']} translations={t} … />
 */
export const SearchSummaryPanel: React.FC<SearchSummaryPanelProps> = (props) => (
  <aside className="search-summary" aria-label="Antes de buscar">
    <h2 className="search-summary__title">Antes de buscar</h2>
    <div className="search-summary__block">
      <span className="search-label">Query</span>
      <code className="search-code">{props.readableQuery}</code>
    </div>
    <div className="search-summary__block" aria-label="Como cada base recebe">
      <span className="search-label">Como cada base recebe</span>
      {props.selected.map((dbId) => (
        <QueryTranslationCard
          key={dbId}
          databaseName={SEARCH_DATABASES.find((d) => d.id === dbId)?.label ?? dbId}
          translation={props.translations[dbId]}
          customQuery={props.customQueries[dbId]}
          onCustomQueryChange={(query) => props.onCustomQueryChange(dbId, query)}
        />
      ))}
    </div>
    <div className="search-summary__tiles">
      <Tile label="Bases" value={String(props.selected.length)} />
      <Tile label="Até" value={props.maxResults.toLocaleString('pt-BR')} note="resultados" />
    </div>
    {props.error && (
      <div role="alert" className="search-error">
        {props.error}
      </div>
    )}
    <div className="search-summary__submit">
      <button
        type="submit"
        disabled={props.disabled}
        className={`btn-primary search-submit${props.loading ? ' is-loading' : ''}`}
        aria-keyshortcuts="Control+Enter"
      >
        {props.loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
        {props.loading ? 'Buscando… pode levar alguns minutos' : 'Fazer busca'}
        {!props.loading && <kbd>Ctrl Enter</kbd>}
      </button>
      <span className="search-summary__note">Você revisa os resultados antes de salvar.</span>
    </div>
  </aside>
);
