import React from 'react';
import { Filter } from 'lucide-react';

interface ProjectSidebarProps {
  statusFilter: 'new' | 'read' | 'archived' | 'all';
  setStatusFilter: (status: 'new' | 'read' | 'archived' | 'all') => void;
  uniqueDatabases: string[];
  selectedDatabases: string[];
  setSelectedDatabases: (db: string[]) => void;
  uniqueDocTypes: string[];
  selectedDocType: string;
  setSelectedDocType: (type: string) => void;
  keywordFrequencies: { keyword: string; count: number }[];
  selectedKeyword: string;
  setSelectedKeyword: (keyword: string) => void;
  setCurrentPage: (page: number) => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  statusFilter,
  setStatusFilter,
  uniqueDatabases,
  selectedDatabases,
  setSelectedDatabases,
  uniqueDocTypes,
  selectedDocType,
  setSelectedDocType,
  keywordFrequencies,
  selectedKeyword,
  setSelectedKeyword,
  setCurrentPage
}) => {
  return (
    <div className="card glass-panel fade-in" style={{
      width: '280px',
      flexShrink: 0,
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      border: '1px solid var(--border-color)',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={16} /> Filtros Rápidos
        </span>
      </div>

      {/* Status Filter */}
      <div>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>STATUS</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { id: 'new', label: 'Não Lidos' },
            { id: 'read', label: 'Lidos' },
            { id: 'archived', label: 'Arquivados' },
            { id: 'all', label: 'Todos' }
          ].map(st => (
            <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input 
                type="radio" 
                name="statusFilter"
                checked={statusFilter === st.id}
                onChange={() => {
                  setStatusFilter(st.id as 'new' | 'read' | 'archived' | 'all');
                  setCurrentPage(1);
                }}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>{st.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Databases Filter */}
      {uniqueDatabases.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>BASES DE DADOS</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {uniqueDatabases.map(db => {
              const isChecked = selectedDatabases.includes(db);
              return (
                <label key={db} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input 
                    type="checkbox" 
                    aria-label={db}
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDatabases([...selectedDatabases, db]);
                      } else {
                        setSelectedDatabases(selectedDatabases.filter(d => d !== db));
                      }
                      setCurrentPage(1);
                    }}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span>{db}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Document Type Filter */}
      {uniqueDocTypes.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>TIPO DE DOCUMENTO</h4>
          <select
            value={selectedDocType}
            onChange={(e) => {
              setSelectedDocType(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.9rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)'
            }}
          >
            <option value="">Todos os tipos</option>
            {uniqueDocTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tag Cloud Filter */}
      {keywordFrequencies.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>NUVEM DE PALAVRAS-CHAVE</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {keywordFrequencies.map(({ keyword, count }) => {
              const isActive = selectedKeyword.toLowerCase() === keyword.toLowerCase();
              return (
                <button
                  key={keyword}
                  onClick={() => {
                    if (isActive) {
                      setSelectedKeyword('');
                    } else {
                      setSelectedKeyword(keyword);
                    }
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--color-primary)' : 'var(--border-color)',
                    background: isActive ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--bg-main)',
                    color: isActive ? 'var(--color-primary)' : 'var(--text-main)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 400,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <span>{keyword}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
