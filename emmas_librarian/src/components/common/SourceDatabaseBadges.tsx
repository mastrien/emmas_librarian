import React from 'react';
import { MANUAL_SOURCE, parseSourceDatabases } from '../../utils/sourceDatabases';

interface SourceDatabaseBadgesProps {
  sourceDatabases: unknown;
  emptyPlaceholder?: React.ReactNode;
}

const MANUAL_WARNING = 'Metadados adicionados manualmente (podem conter erros)';

/**
 * One pill per bibliographic source; manually added articles get a warning pill.
 *
 * Usage:
 *   <SourceDatabaseBadges sourceDatabases={article.source_databases} emptyPlaceholder="-" />
 */
export const SourceDatabaseBadges: React.FC<SourceDatabaseBadgesProps> = ({
  sourceDatabases,
  emptyPlaceholder = null,
}) => {
  const sources = parseSourceDatabases(sourceDatabases);
  if (sources.length === 0) return <>{emptyPlaceholder}</>;
  return (
    <>
      {sources.map((source) => (
        <SourceBadge key={source} source={source} />
      ))}
    </>
  );
};

const SourceBadge: React.FC<{ source: string }> = ({ source }) => {
  const isManual = source === MANUAL_SOURCE;
  return (
    <span
      style={{
        padding: '0.2rem 0.6rem',
        background: isManual ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)',
        border: isManual ? '1px solid var(--color-danger)' : '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: isManual ? 'var(--color-danger)' : 'var(--color-primary)',
      }}
      title={isManual ? MANUAL_WARNING : undefined}
    >
      {isManual ? '⚠️ Manual' : source}
    </span>
  );
};
