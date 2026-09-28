import React from 'react';
import { X, Unlock, Lock } from 'lucide-react';
import type { Article } from '../../../types';
import { parseSourceDatabases } from '../../../utils/sourceDatabases';

const pillStyle: React.CSSProperties = {
  padding: '0.2rem 0.6rem',
  borderRadius: 'var(--radius-xl)',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const accessPillStyle = (isOa: boolean): React.CSSProperties => ({
  ...pillStyle,
  background: isOa ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
  border: isOa ? '1px solid var(--color-success, #10b981)' : '1px solid var(--text-muted)',
  color: isOa ? 'var(--color-success, #10b981)' : 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
});

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: '0.2rem',
  borderRadius: '50%',
  transition: 'background var(--transition-fast)',
};

/**
 * Source database pills, open-access status, the title and the close button.
 *
 * Usage:
 *   <ArticleDetailsHeader article={article} onClose={close} />
 */
// Only what the source reported: is_oa is null for Crossref/WoS and manual articles.
const AccessPill: React.FC<{ isOa?: number | null }> = ({ isOa }) => {
  if (isOa !== 0 && isOa !== 1) return null;
  const open = isOa === 1;
  return (
    <span style={accessPillStyle(open)}>
      {open ? <Unlock size={12} /> : <Lock size={12} />}
      {open ? 'Acesso Aberto' : 'Acesso Fechado'}
    </span>
  );
};

export const ArticleDetailsHeader: React.FC<{ article: Article; onClose: () => void }> = ({ article, onClose }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {parseSourceDatabases(article.source_databases).map((db) => (
            <span
              key={db}
              style={{
                ...pillStyle,
                background: 'rgba(79, 70, 229, 0.1)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
              }}
            >
              {db}
            </span>
          ))}
          <AccessPill isOa={article.is_oa} />
        </div>
        <h2 style={{ margin: 0, color: 'var(--text-heading)', fontSize: '1.5rem', lineHeight: '1.3' }}>
          {article.title}
        </h2>
      </div>
      <button
        style={closeButtonStyle}
        onClick={onClose}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <X size={20} />
      </button>
    </div>
  );
};
