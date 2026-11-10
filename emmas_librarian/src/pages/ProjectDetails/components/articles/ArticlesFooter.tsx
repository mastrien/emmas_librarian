import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { resultCountLabel } from './FilterChips';

interface ArticlesFooterProps {
  shown: number;
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (updater: (page: number) => number) => void;
}

const Hint: React.FC<{ keys: string[]; label: string }> = ({ keys, label }) => (
  <span className="articles-footer__hint">
    {keys.map((k) => (
      <kbd key={k}>{k}</kbd>
    ))}
    {label}
  </span>
);

/**
 * "1–50 de 96": the rows of this page when there is more than one.
 *
 * @example pageRangeLabel(2, 50, 96) // '51–96 de 96'
 */
export function pageRangeLabel(page: number, pageSize: number, count: number): string {
  const first = (page - 1) * pageSize + 1;
  return `${first}–${Math.min(count, page * pageSize)} de ${count}`;
}

/**
 * Under the table (board 153): the keyboard shortcuts on the left; how many articles the filters leave and the
 * pages on the right.
 *
 * @example <ArticlesFooter shown={96} total={96} currentPage={1} totalPages={2} pageSize={50} onPageChange={set} />
 */
export const ArticlesFooter: React.FC<ArticlesFooterProps> = (props) => {
  const { currentPage, totalPages, onPageChange } = props;
  return (
    <div className="articles-footer">
      <Hint keys={['J', 'K']} label="linha" />
      <Hint keys={['Enter']} label="abrir" />
      <Hint keys={['X']} label="selecionar" />
      <span className="articles-footer__count">{resultCountLabel(props.shown, props.total)}</span>
      {totalPages > 1 && (
        <span className="articles-footer__pages">
          {pageRangeLabel(currentPage, props.pageSize, props.shown)}
          <button
            type="button"
            className="row-icon-button"
            aria-label="Página anterior"
            disabled={currentPage === 1}
            onClick={() => onPageChange((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="row-icon-button"
            aria-label="Próxima página"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight size={16} />
          </button>
        </span>
      )}
    </div>
  );
};
