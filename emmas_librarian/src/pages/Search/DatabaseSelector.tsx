import React from 'react';
import { SEARCH_DATABASES } from './searchQueries';

interface DatabaseSelectorProps {
  selected: string[];
  onToggle: (dbId: string) => void;
}

const chipStyle = (isSelected: boolean): React.CSSProperties => ({
  padding: '0.75rem 1.5rem',
  borderRadius: 'var(--radius-xl)',
  border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
  background: isSelected ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--bg-surface)',
  color: isSelected ? 'var(--color-primary)' : 'var(--text-muted)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

const dotStyle = (isSelected: boolean): React.CSSProperties => ({
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  background: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
});

/**
 * Toggle chips for the bibliographic databases to search.
 *
 * Usage:
 *   <DatabaseSelector selected={['openalex']} onToggle={toggleDb} />
 */
export const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({ selected, onToggle }) => (
  <div className="card" style={{ padding: '2rem' }}>
    <label
      style={{
        display: 'block',
        marginBottom: '1rem',
        fontWeight: 600,
        color: 'var(--text-heading)',
        fontSize: '1.1rem',
      }}
    >
      Bases de Dados Alvo
    </label>
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {SEARCH_DATABASES.map((db) => {
        const isSelected = selected.includes(db.id);
        return (
          <button key={db.id} type="button" onClick={() => onToggle(db.id)} style={chipStyle(isSelected)}>
            <div style={dotStyle(isSelected)}></div>
            {db.label}
          </button>
        );
      })}
    </div>
    {selected.length === 0 && (
      <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem', marginTop: '1rem' }}>
        Selecione pelo menos uma base.
      </p>
    )}
  </div>
);
