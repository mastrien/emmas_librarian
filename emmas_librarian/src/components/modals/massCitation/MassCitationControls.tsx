import React from 'react';
import type { CitationStyle, CitationOutputFormat } from '../../../services/citationService';
import { CITATION_CHOICES, renderingOf, type CitationChoice } from '../../common/citation/citationChoice';
import { SegmentedControl } from '../../common/SegmentedControl';
import { SelectField } from '../../common/fields';
import type { CitationSortOrder } from './sortCitableArticles';
import '../citation/citation.css';

export interface MassCitationSettings {
  style: CitationStyle;
  format: CitationOutputFormat;
  sortBy: CitationSortOrder;
  useEtAl: boolean;
}

interface MassCitationControlsProps {
  settings: MassCitationSettings;
  onChange: (settings: MassCitationSettings) => void;
}

const SORT_OPTIONS = [
  { value: 'author', label: 'Ordem alfabética (autor)' },
  { value: 'year', label: 'Ordem cronológica (ano)' },
];

/** The one picker's value: BibTeX is a format, every other choice is a style. */
export const choiceOf = (settings: MassCitationSettings): CitationChoice =>
  settings.format === 'bibtex' ? 'bibtex' : settings.style;

/**
 * Format picker (board 177), sort order and "et al." for the mass citation list.
 *
 * Usage:
 *   <MassCitationControls settings={settings} onChange={setSettings} />
 */
export const MassCitationControls: React.FC<MassCitationControlsProps> = ({ settings, onChange }) => {
  const set = <K extends keyof MassCitationSettings>(key: K, value: MassCitationSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <>
      <SegmentedControl<CitationChoice>
        label="Formato da citação"
        options={[...CITATION_CHOICES]}
        value={choiceOf(settings)}
        onChange={(choice) => onChange({ ...settings, ...renderingOf(choice) })}
      />
      <div className="citation-mass-options">
        <SelectField
          compact
          label="Ordenar por"
          value={settings.sortBy}
          options={SORT_OPTIONS}
          onChange={(e) => set('sortBy', e.target.value as CitationSortOrder)}
        />
        <label className="citation-option">
          <input type="checkbox" checked={settings.useEtAl} onChange={(e) => set('useEtAl', e.target.checked)} />
          Usar &quot;et al.&quot;
        </label>
      </div>
    </>
  );
};
