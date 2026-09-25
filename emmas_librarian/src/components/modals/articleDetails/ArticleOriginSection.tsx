import React from 'react';
import type { SearchHistoryItem } from '../../../types';
import { sectionCaptionStyle, sectionStyle } from './sectionStyles';

interface ArticleOriginSectionProps {
  searchId?: number;
  history: SearchHistoryItem[];
  onNavigateToSearch?: (searchId: number) => void;
}

const IDLE_BACKGROUND = 'rgba(79, 70, 229, 0.1)';

const originButtonStyle: React.CSSProperties = {
  background: IDLE_BACKGROUND,
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  padding: '0.3rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  transition: 'all var(--transition-fast)',
};

const manualBadgeStyle: React.CSSProperties = {
  padding: '0.2rem 0.6rem',
  background: 'rgba(245, 158, 11, 0.1)',
  border: '1px solid #f59e0b',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#f59e0b',
  display: 'inline-block',
};

/**
 * Which search or import brought the article into the project, linking back to it; manual entries are flagged.
 *
 * Usage:
 *   <ArticleOriginSection searchId={article.search_id} history={history} onNavigateToSearch={openSearch} />
 */
export const ArticleOriginSection: React.FC<ArticleOriginSectionProps> = ({
  searchId,
  history,
  onNavigateToSearch,
}) => (
  <div style={sectionStyle}>
    <div style={sectionCaptionStyle('0.4rem')}>ORIGEM NO PROJETO</div>
    {searchId ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <OriginSearchLink
          searchId={searchId}
          search={history.find((h) => h.id === searchId)}
          onNavigate={onNavigateToSearch}
        />
      </div>
    ) : (
      <span style={manualBadgeStyle}>Cadastro Manual ⚠️</span>
    )}
  </div>
);

interface OriginSearchLinkProps {
  searchId: number;
  search?: SearchHistoryItem;
  onNavigate?: (searchId: number) => void;
}

const OriginSearchLink: React.FC<OriginSearchLinkProps> = ({ searchId, search, onNavigate }) => {
  if (!search) {
    return (
      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
        Busca #{searchId} (Histórico carregando...)
      </span>
    );
  }
  // File imports are logged in the search history with an "Importação ..." query.
  const kind = search.unified_query.startsWith('Importação') ? (
    <>📦 Importação #{searchId}</>
  ) : (
    <>🔍 Busca #{searchId}</>
  );
  return (
    <button
      onClick={() => onNavigate?.(searchId)}
      style={originButtonStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-primary)';
        e.currentTarget.style.color = 'white';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = IDLE_BACKGROUND;
        e.currentTarget.style.color = 'var(--color-primary)';
      }}
    >
      {kind}
      {' - '}
      {search.unified_query}
    </button>
  );
};
