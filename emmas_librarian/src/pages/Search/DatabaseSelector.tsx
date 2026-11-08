import React from 'react';
import { IEEE_EXPERIMENTAL_NOTE, SEARCH_DATABASES } from './searchQueries';
import './search.css';

interface DatabaseSelectorProps {
  selected: string[];
  onToggle: (dbId: string) => void;
}

/**
 * Toggle chips for the bibliographic databases to search.
 *
 * Usage:
 *   <DatabaseSelector selected={['openalex']} onToggle={toggleDb} />
 */
export const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({ selected, onToggle }) => (
  <div className="card search-card">
    <label className="search-section-label search-db-label">Bases de Dados Alvo</label>
    <div className="search-db-chips">
      {SEARCH_DATABASES.map((db) => {
        const isSelected = selected.includes(db.id);
        return (
          <button
            key={db.id}
            type="button"
            onClick={() => onToggle(db.id)}
            className={`search-db-chip${isSelected ? ' is-selected' : ''}`}
            // The tag is its own span; without this, Chromium reads the name as "IEEE XploreExperimental".
            aria-label={db.experimental ? `${db.label} (experimental)` : undefined}
          >
            <div className="search-db-dot"></div>
            {db.label}
            {db.experimental && <span className="search-db-experimental">Experimental</span>}
          </button>
        );
      })}
    </div>
    {selected.includes('ieee') && (
      <p role="note" className="search-db-message search-db-message--warning">
        {IEEE_EXPERIMENTAL_NOTE}
      </p>
    )}
    {selected.length === 0 && (
      <p className="search-db-message search-db-message--danger">Selecione pelo menos uma base.</p>
    )}
  </div>
);
