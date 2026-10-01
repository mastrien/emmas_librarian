import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (updater: (page: number) => number) => void;
}

const previous = (page: number) => Math.max(1, page - 1);
const next = (totalPages: number) => (page: number) => Math.min(totalPages, page + 1);

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
