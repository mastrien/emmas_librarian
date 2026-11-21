import React from 'react';

interface DiaryPagerProps {
  label: string;
  previous: string | null;
  next: string | null;
  onGo: (date: string) => void;
  onOpenCalendar: () => void;
}

/**
 * The bar over a diary page: the page before, the date (which opens the calendar), the page after.
 *
 * @example <DiaryPager label="Hoje · 21 de novembro" previous="2026-11-20" next={null} onGo={go} onOpenCalendar={open} />
 */
export const DiaryPager: React.FC<DiaryPagerProps> = ({ label, previous, next, onGo, onOpenCalendar }) => (
  <div className="m-pager">
    <button aria-label="Página anterior" disabled={!previous} onClick={() => previous && onGo(previous)}>
      ‹
    </button>
    <button aria-label="Escolher outra página" aria-haspopup="dialog" onClick={onOpenCalendar}>
      {label} ▾
    </button>
    <button aria-label="Próxima página" disabled={!next} onClick={() => next && onGo(next)}>
      ›
    </button>
  </div>
);
