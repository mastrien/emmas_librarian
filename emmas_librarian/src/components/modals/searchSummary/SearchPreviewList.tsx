import React from 'react';
import { LayoutList } from 'lucide-react';
import type { SearchPreviewItem } from '../../../types';

const alreadyInProjectBadge: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  padding: '0.1rem 0.4rem',
  borderRadius: '4px',
  background: 'rgba(245, 158, 11, 0.15)',
  color: '#b45309',
  whiteSpace: 'nowrap',
};

const titleLinkStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--color-primary)',
  background: 'none',
  border: 'none',
  padding: 0,
  textAlign: 'left',
  textDecoration: 'underline',
  cursor: 'pointer',
  font: 'inherit',
};

type OpenDetails = (item: SearchPreviewItem) => void;

const PreviewRow: React.FC<{ item: SearchPreviewItem; onOpenDetails: OpenDetails }> = ({ item, onOpenDetails }) => (
  <li style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--border-color)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
      <button type="button" onClick={() => onOpenDetails(item)} style={titleLinkStyle} title="Ver os metadados">
        {item.title}
      </button>
      {item.alreadyInProject && <span style={alreadyInProjectBadge}>Já no projeto</span>}
    </div>
    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
      {[item.authors, item.year, item.sourceDatabases.join(', ')].filter(Boolean).join(' · ')}
    </div>
  </li>
);

/**
 * The deduplicated results of a search that is not saved yet, so the user can judge the query;
 * each title opens that result's metadata.
 *
 * @example <SearchPreviewList results={preview.results} onOpenDetails={setSelected} />
 */
export const SearchPreviewList: React.FC<{ results: SearchPreviewItem[]; onOpenDetails: OpenDetails }> = ({
  results,
  onOpenDetails,
}) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <LayoutList size={18} /> Artigos Encontrados
    </h3>
    {results.length === 0 ? (
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum artigo encontrado com essa busca.</p>
    ) : (
      <ul
        aria-label="Artigos encontrados"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          maxHeight: '260px',
          overflowY: 'auto',
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        {results.map((item, index) => (
          <PreviewRow key={`${item.doi ?? item.title}-${index}`} item={item} onOpenDetails={onOpenDetails} />
        ))}
      </ul>
    )}
  </div>
);
