import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageNumbers } from '../../utils/pageNumbers';
import './numberedPages.css';

/**
 * Numbered page buttons, with the previous and next arrows. Shows nothing for a single page.
 *
 * @example <NumberedPages label="Páginas de Incluso" page={2} pages={9} onPage={setPage} />
 */
export const NumberedPages: React.FC<{
  label: string;
  page: number;
  pages: number;
  onPage: (page: number) => void;
}> = ({ label, page, pages, onPage }) => {
  if (pages <= 1) return null;
  return (
    <nav className="numbered-pages" aria-label={label}>
      <button
        type="button"
        className="numbered-pages-step"
        aria-label="Página anterior"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {pageNumbers(page, pages).map((mark, i) =>
        mark === 'gap' ? (
          <span key={`gap-${i}`} className="numbered-pages-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={mark}
            type="button"
            className="numbered-pages-number"
            aria-label={`Página ${mark}`}
            aria-current={mark === page ? 'page' : undefined}
            onClick={() => onPage(mark)}
          >
            {mark}
          </button>
        ),
      )}
      <button
        type="button"
        className="numbered-pages-step"
        aria-label="Próxima página"
        disabled={page === pages}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
};
