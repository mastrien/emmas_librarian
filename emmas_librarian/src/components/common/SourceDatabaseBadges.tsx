import React from 'react';
import { MANUAL_SOURCE, baseShortName, parseSourceDatabases } from '../../utils/sourceDatabases';
import './sourceDatabaseBadges.css';

interface SourceDatabaseBadgesProps {
  sourceDatabases: unknown;
  emptyPlaceholder?: React.ReactNode;
  /** Abbreviated names ("WoS") for narrow columns; the full name stays in the tooltip and for screen readers. */
  compact?: boolean;
}

const MANUAL_WARNING = 'Metadados adicionados manualmente (podem conter erros)';

/**
 * One pill per bibliographic source; manually added articles get a warning pill.
 *
 * Usage:
 *   <SourceDatabaseBadges sourceDatabases={article.source_databases} emptyPlaceholder="-" compact />
 */
export const SourceDatabaseBadges: React.FC<SourceDatabaseBadgesProps> = ({
  sourceDatabases,
  emptyPlaceholder = null,
  compact = false,
}) => {
  const sources = parseSourceDatabases(sourceDatabases);
  if (sources.length === 0) return <>{emptyPlaceholder}</>;
  return (
    <>
      {sources.map((source) => (
        <SourceBadge key={source} source={source} compact={compact} />
      ))}
    </>
  );
};

const SourceBadge: React.FC<{ source: string; compact: boolean }> = ({ source, compact }) => {
  const isManual = source === MANUAL_SOURCE;
  const label = isManual ? 'Manual' : compact ? baseShortName(source) : source;
  return (
    <span
      className={`source-badge${isManual ? ' source-badge--manual' : ''}${compact ? ' source-badge--compact' : ''}`}
      // The full name only where the visible text is not enough: an abbreviation, or the manual warning.
      title={isManual ? MANUAL_WARNING : compact ? source : undefined}
      aria-label={isManual ? MANUAL_WARNING : compact ? source : undefined}
    >
      {isManual && !compact && '⚠️ '}
      {label}
    </span>
  );
};
