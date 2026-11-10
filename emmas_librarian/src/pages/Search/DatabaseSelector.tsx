import React from 'react';
import { Check, KeyRound } from 'lucide-react';
import { IEEE_EXPERIMENTAL_NOTE, KEYED_DATABASES, SEARCH_DATABASES, type SearchApiKeys } from './searchQueries';
import './search.css';

interface DatabaseSelectorProps {
  selected: string[];
  onToggle: (dbId: string) => void;
  /** The saved keys: a base that needs one shows whether it is there. */
  apiKeys: SearchApiKeys;
}

type KeyState = 'none' | 'saved' | 'missing';

const keyStateOf = (dbId: string, keys: SearchApiKeys): KeyState => {
  if (!(KEYED_DATABASES as readonly string[]).includes(dbId)) return 'none';
  return keys[dbId as keyof SearchApiKeys] ? 'saved' : 'missing';
};

const KEY_TITLES: Record<Exclude<KeyState, 'none'>, string> = {
  saved: 'Chave de API salva',
  missing: 'Pede chave de API: falta a chave',
};

/**
 * Step 1 of the search (board 158): the bases as toggle chips, a check on the chosen ones; a key on those that need
 * an API key, in the accent when it is saved and grey when it is missing (decision on the redesign canvas).
 *
 * Usage:
 *   <DatabaseSelector selected={['openalex']} onToggle={toggleDb} apiKeys={keys} />
 */
export const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({ selected, onToggle, apiKeys }) => (
  <>
    <div className="search-db-chips">
      {SEARCH_DATABASES.map((db) => {
        const isSelected = selected.includes(db.id);
        const key = keyStateOf(db.id, apiKeys);
        return (
          <button
            key={db.id}
            type="button"
            onClick={() => onToggle(db.id)}
            aria-pressed={isSelected}
            className={`search-db-chip${isSelected ? ' is-selected' : ''}`}
            // The tag is its own span; without this, Chromium reads the name as "IEEE XploreExperimental".
            aria-label={db.experimental ? `${db.label} (experimental)` : undefined}
          >
            {isSelected && <Check size={14} aria-hidden="true" className="search-db-check" />}
            {db.label}
            {key !== 'none' && (
              <span className={`search-db-key search-db-key--${key}`} title={KEY_TITLES[key]} aria-hidden="true">
                <KeyRound size={13} />
              </span>
            )}
            {db.experimental && <span className="search-db-experimental">Exp.</span>}
          </button>
        );
      })}
    </div>
    <p className="search-db-hint">
      <KeyRound size={13} aria-hidden="true" /> Pede chave de API. Em destaque: chave já salva. Cinza: falta a chave.
    </p>
    {selected.includes('ieee') && (
      <p role="note" className="search-db-message search-db-message--warning">
        {IEEE_EXPERIMENTAL_NOTE}
      </p>
    )}
    {selected.length === 0 && (
      <p className="search-db-message search-db-message--danger">Selecione pelo menos uma base.</p>
    )}
  </>
);
