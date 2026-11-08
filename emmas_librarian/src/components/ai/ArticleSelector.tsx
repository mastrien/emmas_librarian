import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { type Article, type SearchHistoryItem } from '../../types';
import {
  matchesSearch,
  matchesTerm,
  parseSearchFilter,
  searchFilterOptions,
  sortArticles,
  type SearchFilter,
  type SearchFilterOption,
  type SortOption,
} from './articleSelector/articleSelectorQueries';
import { ArticleOption } from './articleSelector/ArticleOption';
import './articleSelector/articleSelector.css';

export type { SortOption } from './articleSelector/articleSelectorQueries';

export interface ArticleSelectorProps {
  articles: Article[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  searchHistory?: SearchHistoryItem[];
  disabled?: boolean;
}

interface ControlsProps {
  term: string;
  onTerm: (term: string) => void;
  searchFilter: SearchFilter;
  onSearchFilter: (filter: SearchFilter) => void;
  options: SearchFilterOption[];
  sortBy: SortOption;
  onSortBy: (sort: SortOption) => void;
  disabled: boolean;
}

const SelectorControls: React.FC<ControlsProps> = (props) => (
  <div className="article-selector-controls">
    <div className="article-selector-control article-selector-control--wide">
      <Search size={14} />
      <input
        type="text"
        className="input-field"
        value={props.term}
        onChange={(e) => props.onTerm(e.target.value)}
        placeholder="Buscar por título, autor, ano..."
        disabled={props.disabled}
      />
    </div>
    <div className="article-selector-control">
      <Filter size={14} />
      <select
        className="input-field"
        value={props.searchFilter}
        onChange={(e) => props.onSearchFilter(parseSearchFilter(e.target.value))}
        disabled={props.disabled}
      >
        <option value="all">Todas as buscas do histórico ({props.options.length})</option>
        {props.options.map((opt) => (
          <option key={String(opt.id)} value={opt.id}>
            {opt.label} ({opt.count} com PDF)
          </option>
        ))}
      </select>
    </div>
    <div className="article-selector-control">
      <ArrowUpDown size={14} />
      <select
        className="input-field"
        value={props.sortBy}
        onChange={(e) => props.onSortBy(e.target.value as SortOption)}
        disabled={props.disabled}
      >
        <option value="title-asc">Título (A-Z)</option>
        <option value="title-desc">Título (Z-A)</option>
        <option value="year-desc">Ano (Mais recente)</option>
        <option value="year-asc">Ano (Mais antigo)</option>
        <option value="authors-asc">Autores (A-Z)</option>
        <option value="search-id">Busca de Origem</option>
      </select>
    </div>
  </div>
);

interface SelectionBarProps {
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  allIds: number[];
  visibleIds: number[];
  disabled: boolean;
}

const SelectionBar: React.FC<SelectionBarProps> = ({ selectedIds, setSelectedIds, allIds, visibleIds, disabled }) => {
  const filtered = visibleIds.length !== allIds.length;
  const visible = new Set(visibleIds);
  return (
    <div className="article-selector-bar">
      <span className="article-selector-count">
        <strong>{selectedIds.length}</strong> de <strong>{allIds.length}</strong> selecionados
        {filtered && <span> ({visibleIds.length} visíveis no filtro)</span>}
      </span>
      {!disabled && (
        <div className="article-selector-bulk">
          {filtered && (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...visibleIds])))}
                title="Selecionar todos os artigos visíveis pelo filtro"
              >
                Selecionar Visíveis
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedIds(selectedIds.filter((id) => !visible.has(id)))}
                title="Desmarcar artigos visíveis pelo filtro"
              >
                Desmarcar Visíveis
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={() => setSelectedIds(allIds)}>
            Selecionar Todos
          </button>
          <button type="button" className="btn-secondary" onClick={() => setSelectedIds([])}>
            Desmarcar Todos
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Picks the articles an investigation runs on: search by text, narrow to one search of the history, sort, and tick
 * one by one or all (visible) at once.
 *
 * @example <ArticleSelector articles={withPdf} selectedIds={ids} setSelectedIds={setIds} searchHistory={history} />
 */
export const ArticleSelector: React.FC<ArticleSelectorProps> = (props) => {
  const { articles, selectedIds, setSelectedIds, searchHistory = [], disabled = false } = props;
  const [term, setTerm] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('title-asc');
  const options = useMemo(() => searchFilterOptions(articles, searchHistory), [articles, searchHistory]);
  const shown = useMemo(
    () =>
      sortArticles(
        articles.filter((a) => matchesTerm(a, term) && matchesSearch(a, searchFilter)),
        sortBy,
      ),
    [articles, term, searchFilter, sortBy],
  );
  const toggle = (id: number) =>
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);

  return (
    <div className="article-selector">
      <SelectorControls
        {...{ term, searchFilter, options, sortBy, disabled }}
        onTerm={setTerm}
        onSearchFilter={setSearchFilter}
        onSortBy={setSortBy}
      />
      <SelectionBar
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        allIds={articles.map((a) => a.id)}
        visibleIds={shown.map((a) => a.id)}
        disabled={disabled}
      />
      <div className="article-selector-list">
        {shown.length === 0 ? (
          <div className="article-selector-empty">Nenhum artigo encontrado com os filtros aplicados.</div>
        ) : (
          shown.map((art) => (
            <ArticleOption
              key={art.id}
              article={art}
              selected={selectedIds.includes(art.id)}
              disabled={disabled}
              searchHistory={searchHistory}
              onToggle={() => toggle(art.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
