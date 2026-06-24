import React from 'react';
import { Search, Loader2 } from 'lucide-react';

interface SearchTabProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  searchResults: Array<{ pageNumber: number; snippet: string }>;
  onSearch: (e: React.FormEvent) => void;
  onResultClick: (pageNum: number) => void;
}

export const SearchTab: React.FC<SearchTabProps> = ({
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  onSearch,
  onResultClick,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)', marginBottom: '1rem' }}>
          Buscar no PDF
        </h3>
        <form onSubmit={onSearch} style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Termo para busca..."
              style={{
                width: '100%',
                padding: '0.5rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="btn-primary"
            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
        </form>
      </div>

      <div
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {isSearching ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
            Pesquisando termo...
          </div>
        ) : searchResults.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
            {searchQuery ? 'Nenhum resultado encontrado.' : 'Digite um termo para pesquisar.'}
          </p>
        ) : (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
              {searchResults.length} ocorrência(s) encontrada(s)
            </div>
            {searchResults.map((res, idx) => (
              <div
                key={`search-${idx}`}
                onClick={() => onResultClick(res.pageNumber)}
                className="card hover-lift"
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                  }}
                >
                  <span>Página {res.pageNumber}</span>
                </div>
                <div style={{ color: 'var(--text-main)', lineHeight: '1.4' }}>
                  {(() => {
                    const term = searchQuery;
                    const lowerSnippet = res.snippet.toLowerCase();
                    const lowerTerm = term.toLowerCase();
                    const termIdx = lowerSnippet.indexOf(lowerTerm);

                    if (termIdx === -1) return res.snippet;

                    const before = res.snippet.substring(0, termIdx);
                    const match = res.snippet.substring(termIdx, termIdx + term.length);
                    const after = res.snippet.substring(termIdx + term.length);

                    return (
                      <>
                        {before}
                        <mark
                          style={{
                            background: 'rgba(234, 179, 8, 0.3)',
                            color: 'var(--text-heading)',
                            fontWeight: 600,
                            padding: '0 0.1rem',
                            borderRadius: '2px',
                          }}
                        >
                          {match}
                        </mark>
                        {after}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
