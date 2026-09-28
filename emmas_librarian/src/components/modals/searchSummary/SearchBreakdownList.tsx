import React from 'react';
import { Database } from 'lucide-react';
import type { SearchBreakdown } from '../../../types';
import { SEARCH_DATABASES } from '../../../pages/Search/searchQueries';

// Official names ("OpenAlex", not the capitalized id "Openalex").
const databaseLabel = (db: string): string => SEARCH_DATABASES.find((d) => d.id === db)?.label ?? db;

/**
 * How many results each database returned, or why it failed.
 *
 * @example <SearchBreakdownList breakdown={{ openalex: { count: 3 }, crossref: { count: 0, error: 'HTTP 503' } }} />
 */
export const SearchBreakdownList: React.FC<{ breakdown: SearchBreakdown }> = ({ breakdown }) => (
  <section aria-label="Resultados por base" style={{ marginBottom: '1.5rem' }}>
    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Database size={18} /> Resultados por Base
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Object.entries(breakdown).map(([db, data]) => (
        <div
          key={db}
          style={{
            padding: '0.8rem 1rem',
            background: 'var(--bg-main)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${data.error ? 'var(--color-danger)' : 'var(--border-color)'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{databaseLabel(db)}</span>
            <span style={{ fontWeight: 700, color: data.error ? 'var(--color-danger)' : 'var(--text-heading)' }}>
              {data.error ? 'Falha' : data.count}
            </span>
          </div>
          {data.error && (
            <div
              style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.25rem', fontStyle: 'italic' }}
            >
              {data.error}
            </div>
          )}
        </div>
      ))}
    </div>
  </section>
);
