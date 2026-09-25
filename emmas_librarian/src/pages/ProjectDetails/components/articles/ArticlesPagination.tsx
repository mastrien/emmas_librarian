import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (updater: (page: number) => number) => void;
}

interface PaginationSummaryProps extends PaginationProps {
  pageSize: number;
  totalItems: number;
}

const previous = (page: number) => Math.max(1, page - 1);
const next = (totalPages: number) => (page: number) => Math.min(totalPages, page + 1);

/**
 * "Mostrando X-Y de N artigos" line with compact previous/next buttons, shown above the list.
 *
 * Usage:
 *   <PaginationSummary currentPage={p} totalPages={t} pageSize={50} totalItems={n} onPageChange={setPage} />
 */
export const PaginationSummary: React.FC<PaginationSummaryProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}) => {
  const firstShown = (currentPage - 1) * pageSize + 1;
  const lastShown = Math.min(currentPage * pageSize, totalItems);
  const compact: React.CSSProperties = { padding: '0.3rem 0.6rem', fontSize: '0.8rem' };
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}
    >
      <span>
        Mostrando {firstShown}-{lastShown} de {totalItems} artigos
      </span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(previous)}
          disabled={currentPage === 1}
          className="btn-secondary"
          style={compact}
        >
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontWeight: 600 }}>
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(next(totalPages))}
          disabled={currentPage === totalPages}
          className="btn-secondary"
          style={compact}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

/**
 * Full "Anterior / Próxima" controls shown below the list.
 *
 * Usage:
 *   <PaginationControls currentPage={p} totalPages={t} onPageChange={setPage} />
 */
export const PaginationControls: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem' }}>
    <button
      onClick={() => onPageChange(previous)}
      disabled={currentPage === 1}
      className="btn-secondary"
      style={{ padding: '0.4rem 0.8rem' }}
    >
      <ChevronLeft size={16} /> Anterior
    </button>
    <span style={{ padding: '0 1rem', color: 'var(--text-muted)' }}>
      {currentPage} / {totalPages}
    </span>
    <button
      onClick={() => onPageChange(next(totalPages))}
      disabled={currentPage === totalPages}
      className="btn-secondary"
      style={{ padding: '0.4rem 0.8rem' }}
    >
      Próxima <ChevronRight size={16} />
    </button>
  </div>
);
