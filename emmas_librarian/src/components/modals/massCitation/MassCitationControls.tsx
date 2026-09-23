import React from 'react';
import { FileText, Code, Braces } from 'lucide-react';
import type { CitationStyle, CitationOutputFormat } from '../../../services/citationService';
import { CITATION_STYLE_OPTIONS } from '../../common/citation/citationStyles';
import type { CitationSortOrder } from './sortCitableArticles';

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

const FORMAT_BUTTONS: ReadonlyArray<{ value: CitationOutputFormat; label: string; Icon: typeof FileText }> = [
  { value: 'html', label: 'HTML', Icon: FileText },
  { value: 'text', label: 'Texto', Icon: Code },
  { value: 'bibtex', label: 'BibTeX', Icon: Braces },
];

const barStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1.2fr 1fr',
  gap: '1rem',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem',
};

const headingStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.3rem',
  color: 'var(--text-muted)',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)',
  outline: 'none',
  background: 'var(--bg-surface)',
  color: 'var(--text-main)',
};

const formatButtonStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  fontSize: '0.8rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  flex: 1,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: 'var(--text-main)',
};

/**
 * Style, "et al.", output format and sort order pickers for the mass citation list.
 *
 * Usage:
 *   <MassCitationControls settings={settings} onChange={setSettings} />
 */
export const MassCitationControls: React.FC<MassCitationControlsProps> = ({ settings, onChange }) => {
  const set = <K extends keyof MassCitationSettings>(key: K, value: MassCitationSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <div style={barStyle}>
      <StylePicker style={settings.style} onChange={(style) => set('style', style)} />
      <EtAlOption checked={settings.useEtAl} onChange={(checked) => set('useEtAl', checked)} />
      <FormatPicker format={settings.format} onChange={(format) => set('format', format)} />
      <SortPicker sortBy={settings.sortBy} onChange={(sortBy) => set('sortBy', sortBy)} />
    </div>
  );
};

const StylePicker: React.FC<{ style: CitationStyle; onChange: (style: CitationStyle) => void }> = ({
  style,
  onChange,
}) => (
  <div>
    <label style={headingStyle}>Estilo da Citação:</label>
    <select value={style} onChange={(e) => onChange(e.target.value as CitationStyle)} style={selectStyle}>
      {CITATION_STYLE_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  </div>
);

const EtAlOption: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <label style={headingStyle}>Opções:</label>
    <label style={checkboxLabelStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: 'pointer' }}
      />
      Usar "et al."
    </label>
  </div>
);

const FormatPicker: React.FC<{ format: CitationOutputFormat; onChange: (format: CitationOutputFormat) => void }> = ({
  format,
  onChange,
}) => (
  <div>
    <label style={headingStyle}>Forma de Exibição:</label>
    <div style={{ display: 'flex', gap: '0.25rem' }}>
      {FORMAT_BUTTONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={format === value ? 'btn-primary' : 'btn-secondary'}
          style={formatButtonStyle}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  </div>
);

const SortPicker: React.FC<{ sortBy: CitationSortOrder; onChange: (sortBy: CitationSortOrder) => void }> = ({
  sortBy,
  onChange,
}) => (
  <div>
    <label style={headingStyle}>Critério de Ordenação:</label>
    <select value={sortBy} onChange={(e) => onChange(e.target.value as CitationSortOrder)} style={selectStyle}>
      <option value="author">Ordem Alfabética (Autor)</option>
      <option value="year">Ordem Cronológica (Ano)</option>
    </select>
  </div>
);
