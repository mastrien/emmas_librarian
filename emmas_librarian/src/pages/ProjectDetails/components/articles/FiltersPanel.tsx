import React from 'react';
import type { ProjectFiltering } from '../../hooks/useProjectFiltering';
import {
  STATUS_LABELS,
  activeFilters,
  clearedFilters,
  type ArticleFilterCriteria,
  type StatusFilter,
} from '../../hooks/articleFilters';

type Apply = (patch: Partial<ArticleFilterCriteria>) => void;
type CountFor = (patch: Partial<ArticleFilterCriteria>) => number;

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
const spokenOption = (label: string, count: number): string =>
  `${label}, ${count} ${count === 1 ? 'artigo' : 'artigos'}`;

const OptionText: React.FC<{ label: string; count: number }> = ({ label, count }) => (
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

const StatusGroup: React.FC<{ criteria: ArticleFilterCriteria; apply: Apply; countFor: CountFor }> = ({
  criteria,
  apply,
  countFor,
}) => (
  <fieldset>
    <legend>STATUS</legend>
    {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((status) => (
      <FilterOption
        key={status}
        type="radio"
        name="article-status"
        label={STATUS_LABELS[status]}
        checked={criteria.statusFilter === status}
        count={countFor({ statusFilter: status })}
        onChange={() => apply({ statusFilter: status })}
      />
    ))}
  </fieldset>
);

const AvailabilityGroup: React.FC<{ criteria: ArticleFilterCriteria; apply: Apply; countFor: CountFor }> = ({
  criteria,
  apply,
  countFor,
}) => (
  <fieldset>
    <legend>DISPONIBILIDADE</legend>
    <FilterOption
      type="checkbox"
      label="Com PDF"
      checked={criteria.onlyWithPdf}
      count={countFor({ onlyWithPdf: true })}
      onChange={() => apply({ onlyWithPdf: !criteria.onlyWithPdf })}
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

const DatabasesGroup: React.FC<{
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
      <legend>BASES DE DADOS</legend>
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

const DocTypeGroup: React.FC<{
  types: string[];
  criteria: ArticleFilterCriteria;
  apply: Apply;
  countFor: CountFor;
}> = ({ types, criteria, apply, countFor }) => (
  <div>
    <label className="filters-panel__label" htmlFor="article-doc-type">
      TIPO DE DOCUMENTO
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

const KeywordsGroup: React.FC<{
  keywords: string[];
  criteria: ArticleFilterCriteria;
  apply: Apply;
  countFor: CountFor;
}> = ({ keywords, criteria, apply, countFor }) => (
  <div>
    <span className="filters-panel__label">PALAVRAS-CHAVE</span>
    <div className="keyword-cloud">
      {keywords.map((keyword) => {
        const on = criteria.keyword === keyword;
        const count = countFor({ keyword });
        return (
          <button
            key={keyword}
            type="button"
            className={`keyword-chip${on ? ' is-on' : ''}${count === 0 && !on ? ' is-empty' : ''}`}
            aria-pressed={on}
            aria-label={spokenOption(keyword, count)}
            onClick={() => apply({ keyword: on ? '' : keyword })}
          >
            <OptionText label={keyword} count={count} />
          </button>
        );
      })}
    </div>
  </div>
);

/**
 * The filter panel beside the article list: status, availability (PDF, open access), databases,
 * document type and keywords, each option with the number of articles it would leave.
 *
 * @example {isSidebarOpen && <FiltersPanel filtering={filtering} />}
 */
export const FiltersPanel: React.FC<{ filtering: ProjectFiltering }> = ({ filtering }) => {
  const { criteria, applyCriteria, countFor } = filtering;
  const apply: Apply = (patch) => applyCriteria({ ...criteria, ...patch });
  const groupProps = { criteria, apply, countFor };
  return (
    <aside id="article-filters" className="filters-panel" aria-label="Filtros">
      <div className="filters-panel__head">
        <span>Filtros</span>
        {activeFilters(criteria).length > 0 && (
          <button type="button" className="link-button" onClick={() => applyCriteria(clearedFilters(criteria))}>
            Limpar
          </button>
        )}
      </div>
      <StatusGroup {...groupProps} />
      <AvailabilityGroup {...groupProps} />
      {filtering.uniqueDatabases.length > 0 && <DatabasesGroup databases={filtering.uniqueDatabases} {...groupProps} />}
      {filtering.uniqueDocTypes.length > 0 && <DocTypeGroup types={filtering.uniqueDocTypes} {...groupProps} />}
      {filtering.keywordFrequencies.length > 0 && (
        <KeywordsGroup keywords={filtering.keywordFrequencies.map((k) => k.keyword)} {...groupProps} />
      )}
    </aside>
  );
};
