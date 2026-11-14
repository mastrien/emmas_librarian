import React from 'react';
import type { ArticleFilterCriteria } from '../../hooks/articleFilters';

// The option groups of the filters popover (board 153), each option with the number of articles it would leave.

export type Apply = (patch: Partial<ArticleFilterCriteria>) => void;
export type CountFor = (patch: Partial<ArticleFilterCriteria>) => number;

export interface GroupProps {
  criteria: ArticleFilterCriteria;
  apply: Apply;
  countFor: CountFor;
}

interface OptionProps {
  type: 'radio' | 'checkbox';
  name?: string;
  label: string;
  checked: boolean;
  count: number;
  onChange: () => void;
}

// Screen readers hear "Com PDF, 2 artigos"; sighted users see just the number. An explicit aria-label,
// because a visually-hidden suffix made Chromium read "Com PDF , 2 artigos" (it pads out-of-flow boxes).
export const spokenOption = (label: string, count: number): string =>
  `${label}, ${count} ${count === 1 ? 'artigo' : 'artigos'}`;

export const OptionText: React.FC<{ label: string; count: number }> = ({ label, count }) => (
  <>
    <span>{label}</span>
    <span className="opt-count" aria-hidden="true">
      {count}
    </span>
  </>
);

// One option with how many articles it would leave (Baymard: show counts); options that leave none are dimmed.
const FilterOption: React.FC<OptionProps> = ({ type, name, label, checked, count, onChange }) => (
  <label className={`filter-option${count === 0 && !checked ? ' is-empty' : ''}`}>
    <input type={type} name={name} checked={checked} onChange={onChange} aria-label={spokenOption(label, count)} />
    <OptionText label={label} count={count} />
  </label>
);

export const AvailabilityGroup: React.FC<GroupProps> = ({ criteria, apply, countFor }) => (
  <fieldset>
    <legend>Disponibilidade</legend>
    <FilterOption
      type="checkbox"
      label="Com PDF"
      checked={criteria.onlyWithPdf}
      count={countFor({ onlyWithPdf: true, onlyWithoutPdf: false })}
      onChange={() => apply({ onlyWithPdf: !criteria.onlyWithPdf, onlyWithoutPdf: false })}
    />
    {/* The two PDF filters exclude each other: both on would show nothing. */}
    <FilterOption
      type="checkbox"
      label="Sem PDF"
      checked={criteria.onlyWithoutPdf}
      count={countFor({ onlyWithoutPdf: true, onlyWithPdf: false })}
      onChange={() => apply({ onlyWithoutPdf: !criteria.onlyWithoutPdf, onlyWithPdf: false })}
    />
    <FilterOption
      type="checkbox"
      label="Acesso aberto"
      checked={criteria.onlyOpenAccess}
      count={countFor({ onlyOpenAccess: true })}
      onChange={() => apply({ onlyOpenAccess: !criteria.onlyOpenAccess })}
    />
  </fieldset>
);

export const DatabasesGroup: React.FC<{
  databases: string[];
  criteria: ArticleFilterCriteria;
  apply: Apply;
  countFor: CountFor;
}> = ({ databases, criteria, apply, countFor }) => {
  const toggle = (db: string) =>
    apply({
      databases: criteria.databases.includes(db)
        ? criteria.databases.filter((d) => d !== db)
        : [...criteria.databases, db],
    });
  return (
    <fieldset>
      <legend>Bases de dados</legend>
      {databases.map((db) => (
        <FilterOption
          key={db}
          type="checkbox"
          label={db}
          checked={criteria.databases.includes(db)}
          count={countFor({ databases: [db] })}
          onChange={() => toggle(db)}
        />
      ))}
    </fieldset>
  );
};

export const DocTypeGroup: React.FC<{
  types: string[];
  criteria: ArticleFilterCriteria;
  apply: Apply;
  countFor: CountFor;
}> = ({ types, criteria, apply, countFor }) => (
  <div>
    <label className="filters-panel__label" htmlFor="article-doc-type">
      Tipo de documento
    </label>
    <select id="article-doc-type" value={criteria.docType} onChange={(e) => apply({ docType: e.target.value })}>
      <option value="">Todos os tipos ({countFor({ docType: '' })})</option>
      {types.map((t) => (
        <option key={t} value={t}>
          {t} ({countFor({ docType: t })})
        </option>
      ))}
    </select>
  </div>
);

const KEYWORDS_SHOWN = 8;

const KeywordChip: React.FC<GroupProps & { keyword: string }> = ({ keyword, criteria, apply, countFor }) => {
  const on = criteria.keyword === keyword;
  const count = countFor({ keyword });
  return (
    <button
      type="button"
      className={`keyword-chip${on ? ' is-on' : ''}${count === 0 && !on ? ' is-empty' : ''}`}
      aria-pressed={on}
      aria-label={spokenOption(keyword, count)}
      onClick={() => apply({ keyword: on ? '' : keyword })}
    >
      <OptionText label={keyword} count={count} />
    </button>
  );
};

/**
 * The most frequent keywords as a cloud of toggles; the first eight show, "+N" brings the rest (board 153).
 *
 * @example <KeywordsGroup keywords={['precipitation', 'radar']} criteria={c} apply={apply} countFor={countFor} />
 */
export const KeywordsGroup: React.FC<GroupProps & { keywords: string[] }> = ({ keywords, ...group }) => {
  const [showAll, setShowAll] = React.useState(false);
  // A chosen keyword past the first eight stays in view.
  const chosenIndex = keywords.indexOf(group.criteria.keyword);
  const shown = showAll ? keywords.length : Math.max(KEYWORDS_SHOWN, chosenIndex + 1);
  return (
    <div>
      <span className="filters-panel__label">Palavras-chave</span>
      <div className="keyword-cloud">
        {keywords.slice(0, shown).map((keyword) => (
          <KeywordChip key={keyword} keyword={keyword} {...group} />
        ))}
        {keywords.length > shown && (
          <button type="button" className="link-button" onClick={() => setShowAll(true)}>
            +{keywords.length - shown}
          </button>
        )}
      </div>
    </div>
  );
};
