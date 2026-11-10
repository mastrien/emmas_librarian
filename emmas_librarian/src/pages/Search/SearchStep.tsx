import React from 'react';

interface SearchStepProps {
  number: number;
  title: string;
  /** Something on the right of the step title: a count, a mode switch. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * One numbered step of the search page (board 158): Bases, Query, Opções, read top to bottom.
 *
 * @example <SearchStep number={1} title="Bases" aside="2 escolhidas">…</SearchStep>
 */
export const SearchStep: React.FC<SearchStepProps> = ({ number, title, aside, children }) => (
  <section className="search-step" aria-labelledby={`search-step-${number}`}>
    <div className="search-step__head">
      <span className="search-step__number" aria-hidden="true">
        {number}
      </span>
      <h2 id={`search-step-${number}`} className="search-step__title">
        {title}
      </h2>
      {aside && <span className="search-step__aside">{aside}</span>}
    </div>
    {children}
  </section>
);
