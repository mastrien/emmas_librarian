import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, FileText } from 'lucide-react';
import { type Article, type SearchHistoryItem } from '../../types';

export type SortOption = 'title-asc' | 'title-desc' | 'year-desc' | 'year-asc' | 'authors-asc' | 'search-id';

export interface ArticleSelectorProps {
  articles: Article[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  searchHistory?: SearchHistoryItem[];
  disabled?: boolean;
}

/**
 * Filter article by search term against title, authors, year, journal, doi.
 */
function filterArticleByTerm(article: Article, term: string): boolean {
  if (!term.trim()) return true;
  const q = term.toLowerCase();
  const title = (article.title || '').toLowerCase();
  const authors = (article.authors || '').toLowerCase();
  const journal = (article.journal || article.publisher || '').toLowerCase();
  const doi = (article.doi || '').toLowerCase();
  const year = article.year ? String(article.year) : '';
  return title.includes(q) || authors.includes(q) || journal.includes(q) || doi.includes(q) || year.includes(q);
}

/**
 * Filter article by selected search history ID.
 */
function filterArticleBySearchId(article: Article, targetSearchId: number | 'all'): boolean {
  if (targetSearchId === 'all') return true;
  return article.search_id === targetSearchId;
}

/**
 * Sort articles list based on chosen sort option.
 */
function sortArticles(articles: Article[], sortBy: SortOption): Article[] {
  const list = [...articles];
  return list.sort((a, b) => {
    if (sortBy === 'title-asc') return a.title.localeCompare(b.title);
    if (sortBy === 'title-desc') return b.title.localeCompare(a.title);
    if (sortBy === 'year-desc') return (b.year || 0) - (a.year || 0);
    if (sortBy === 'year-asc') return (a.year || 0) - (b.year || 0);
    if (sortBy === 'authors-asc') return (a.authors || '').localeCompare(b.authors || '');
    if (sortBy === 'search-id') return (b.search_id || 0) - (a.search_id || 0);
    return 0;
  });
}

/**
 * Formats search origin badge label for an article.
 */
function getSearchBadgeLabel(searchId: number | undefined, searchHistory: SearchHistoryItem[]): string {
  if (!searchId) return 'Manual / Importação';
  const found = searchHistory.find((h) => h.id === searchId);
  if (!found) return `Busca #${searchId}`;
  const queryPreview = found.unified_query.length > 25 ? `${found.unified_query.substring(0, 25)}...` : found.unified_query;
  return `#${searchId}: ${queryPreview}`;
}

export const ArticleSelector: React.FC<ArticleSelectorProps> = ({
  articles,
  selectedIds,
  setSelectedIds,
  searchHistory = [],
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSearchFilter, setSelectedSearchFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('title-asc');

  // Extract unique search_ids present in the articles list for the filter dropdown
  const uniqueSearchIds = useMemo(() => {
    const ids = new Set<number>();
    articles.forEach((a) => {
      if (a.search_id) ids.add(a.search_id);
    });
    return Array.from(ids);
  }, [articles]);

  // Filtered and sorted article list
  const filteredArticles = useMemo(() => {
    const filtered = articles.filter(
      (a) => filterArticleByTerm(a, searchTerm) && filterArticleBySearchId(a, selectedSearchFilter)
    );
    return sortArticles(filtered, sortBy);
  }, [articles, searchTerm, selectedSearchFilter, sortBy]);

  const visibleIds = useMemo(() => filteredArticles.map((a) => a.id), [filteredArticles]);

  const handleSelectVisible = () => {
    const newSelected = Array.from(new Set([...selectedIds, ...visibleIds]));
    setSelectedIds(newSelected);
  };

  const handleDeselectVisible = () => {
    const visibleSet = new Set(visibleIds);
    setSelectedIds(selectedIds.filter((id) => !visibleSet.has(id)));
  };

  const handleSelectAll = () => {
    setSelectedIds(articles.map((a) => a.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleToggleArticle = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Controls Bar: Search, Search History Filter, Sort */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.6rem', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, autor, ano..."
            disabled={disabled}
            style={{
              paddingLeft: '2rem',
              paddingRight: '0.5rem',
              fontSize: '0.75rem',
              width: '100%',
              height: '36px',
              lineHeight: '1.2',
            }}
          />
        </div>

        {/* Search History Filter Dropdown */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Filter size={14} style={{ position: 'absolute', left: '0.6rem', color: 'var(--text-muted)' }} />
          <select
            className="input-field"
            value={selectedSearchFilter}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedSearchFilter(val === 'all' ? 'all' : Number(val));
            }}
            disabled={disabled}
            style={{
              paddingLeft: '2rem',
              paddingRight: '0.5rem',
              fontSize: '0.75rem',
              width: '100%',
              height: '36px',
              lineHeight: '1.2',
            }}
          >
            <option value="all">Todas as buscas ({uniqueSearchIds.length})</option>
            {uniqueSearchIds.map((sId) => (
              <option key={sId} value={sId}>
                {getSearchBadgeLabel(sId, searchHistory)}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Dropdown */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <ArrowUpDown size={14} style={{ position: 'absolute', left: '0.6rem', color: 'var(--text-muted)' }} />
          <select
            className="input-field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            disabled={disabled}
            style={{
              paddingLeft: '2rem',
              paddingRight: '0.5rem',
              fontSize: '0.75rem',
              width: '100%',
              height: '36px',
              lineHeight: '1.2',
            }}
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

      {/* Bulk Action Buttons & Counters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.8rem',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          <strong>{selectedIds.length}</strong> de <strong>{articles.length}</strong> selecionados
          {filteredArticles.length !== articles.length && (
            <span> ({filteredArticles.length} visíveis no filtro)</span>
          )}
        </span>

        {!disabled && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {filteredArticles.length !== articles.length && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={handleSelectVisible}
                  title="Selecionar todos os artigos visíveis pelo filtro"
                >
                  Selecionar Visíveis
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={handleDeselectVisible}
                  title="Desmarcar artigos visíveis pelo filtro"
                >
                  Desmarcar Visíveis
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              onClick={handleSelectAll}
            >
              Selecionar Todos
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              onClick={handleDeselectAll}
            >
              Desmarcar Todos
            </button>
          </div>
        )}
      </div>

      {/* Articles Cards Grid Container */}
      <div
        style={{
          maxHeight: '260px',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.5rem',
          background: 'var(--bg-main)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {filteredArticles.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>
            Nenhum artigo encontrado com os filtros aplicados.
          </div>
        ) : (
          filteredArticles.map((art) => {
            const isSelected = selectedIds.includes(art.id);
            return (
              <label
                key={art.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  cursor: disabled ? 'default' : 'pointer',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected
                    ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                    : 'var(--bg-surface)',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => !disabled && handleToggleArticle(art.id)}
                  disabled={disabled}
                  style={{ marginTop: '0.25rem' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {art.title}
                  </div>

                  {/* Metadata Row: Authors, Year, Journal */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.25rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {art.authors && (
                      <span style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {art.authors}
                      </span>
                    )}
                    {art.year && <span>• {art.year}</span>}
                    {(art.journal || art.publisher) && (
                      <span style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        • {art.journal || art.publisher}
                      </span>
                    )}
                  </div>

                  {/* Badges Row */}
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      🔍 {getSearchBadgeLabel(art.search_id, searchHistory)}
                    </span>
                    {art.local_file_path && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: 'var(--radius-xs)',
                          background: 'color-mix(in srgb, var(--color-success, #10b981) 15%, transparent)',
                          color: 'var(--color-success, #10b981)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        <FileText size={10} /> PDF Anexado
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
};
