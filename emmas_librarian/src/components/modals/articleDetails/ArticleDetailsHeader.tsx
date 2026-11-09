import React from 'react';
import { Unlock, Lock } from 'lucide-react';
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

/**
 * Source database pills and open-access status, above the article's details (the title is the window's).
 *
 * Usage:
 *   <ArticleDetailsHeader article={article} />
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

export const ArticleDetailsHeader: React.FC<{ article: Article }> = ({ article }) => {
  const bases = parseSourceDatabases(article.source_databases);
  if (bases.length === 0 && article.is_oa !== 0 && article.is_oa !== 1) return null;
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {bases.map((db) => (
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
  );
};
