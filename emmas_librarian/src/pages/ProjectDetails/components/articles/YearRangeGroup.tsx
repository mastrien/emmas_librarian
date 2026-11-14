import React from 'react';
import type { YearHistogram } from '../../../../utils/publicationYears';
import type { GroupProps } from './filterGroups';
import { clampYearRange, yearRangeOf } from './yearRange';

interface YearRangeGroupProps extends GroupProps {
  histogram: YearHistogram;
}

// Each bar's height is data, so it stays inline; the look is in articlesToolbar.css.
const YearBars: React.FC<{ histogram: YearHistogram; from: number; to: number }> = ({ histogram, from, to }) => {
  const highest = Math.max(1, ...histogram.bars.map((b) => b.count));
  return (
    <div className="year-range__bars" aria-hidden="true">
      {histogram.bars.map((b) => (
        <i
          key={b.year}
          className={b.year >= from && b.year <= to ? 'is-in' : undefined}
          style={{ height: `${Math.max(4, (b.count / highest) * 100)}%` }}
        />
      ))}
    </div>
  );
};

// Applies on Enter or when the field loses focus: applying each keystroke turned "2005" into "2" first, which the
// range clamps to its first year and so overwrote what was being typed.
const YearInput: React.FC<{ label: string; value: number; onChange: (year: number) => void }> = (props) => {
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = () => {
    if (draft && Number.isInteger(Number(draft))) props.onChange(Number(draft));
    setDraft(null);
  };
  return (
    <input
      type="number"
      className="year-range__input"
      aria-label={props.label}
      value={draft ?? props.value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
};

/**
 * Publication year range (board 153): the articles per year as a histogram, a two-handle slider with the same
 * years in two fields, how many articles fall inside, and whether those without a year stay.
 *
 * @example <YearRangeGroup histogram={yearHistogram(articles)} criteria={c} apply={apply} countFor={countFor} />
 */
export const YearRangeGroup: React.FC<YearRangeGroupProps> = ({ histogram, criteria, apply, countFor }) => {
  const { first, last, from, to } = yearRangeOf(histogram, criteria);
  const set = (nextFrom: number, nextTo: number) => apply(clampYearRange(histogram, nextFrom, nextTo));
  const inside = countFor({ yearFrom: from, yearTo: to, includeNoYear: false });
  return (
    <fieldset className="year-range">
      <legend>Ano</legend>
      <span className="year-range__count">{inside} artigos no intervalo</span>
      <YearBars histogram={histogram} from={from} to={to} />
      <div className="year-range__slider">
        <input
          type="range"
          min={first}
          max={last}
          value={from}
          aria-label="Ano inicial"
          onChange={(e) => set(Number(e.target.value), to)}
        />
        <input
          type="range"
          min={first}
          max={last}
          value={to}
          aria-label="Ano final"
          onChange={(e) => set(from, Number(e.target.value))}
        />
      </div>
      <div className="year-range__fields">
        <YearInput label="De" value={from} onChange={(year) => set(year, to)} />
        <span>a</span>
        <YearInput label="Até" value={to} onChange={(year) => set(from, year)} />
      </div>
      {histogram.withoutYear > 0 && (
        <label className="filter-option">
          <input
            type="checkbox"
            checked={criteria.includeNoYear}
            disabled={criteria.yearFrom === null && criteria.yearTo === null}
            onChange={() => apply({ includeNoYear: !criteria.includeNoYear })}
          />
          <span>Incluir os {histogram.withoutYear} artigos sem ano</span>
        </label>
      )}
    </fieldset>
  );
};
