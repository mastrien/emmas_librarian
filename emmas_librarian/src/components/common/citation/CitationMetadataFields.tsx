import React from 'react';
import { LabeledField } from '../LabeledField';
import { FULL_NAMES_HINT } from '../articleFieldHints';
import type { CitationFields } from '../../../utils/cslMetadata';

interface CitationMetadataFieldsProps {
  fields: CitationFields;
  onChange: (field: keyof CitationFields, value: string) => void;
}

const row = (columns: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: columns, gap: '1rem' });

/**
 * The editable citation metadata form (title, authors, year, DOI, journal, volume, issue, pages, URL, access date).
 *
 * Usage:
 *   <CitationMetadataFields fields={fields} onChange={(field, value) => setFields({ ...fields, [field]: value })} />
 */
export const CitationMetadataFields: React.FC<CitationMetadataFieldsProps> = ({ fields, onChange }) => {
  const field = (name: keyof CitationFields, label: string, type?: 'number' | 'date') => (
    <LabeledField
      compact
      label={label}
      name={name}
      type={type}
      value={fields[name]}
      onChange={(value) => onChange(name, value)}
    />
  );
  return (
    <>
      {field('title', 'Título')}
      <LabeledField
        compact
        label="Autores (separados por ; ou ,)"
        name="authors"
        value={fields.authors}
        onChange={(value) => onChange('authors', value)}
        hint={FULL_NAMES_HINT}
      />
      <div style={row('1fr 1fr')}>
        {field('year', 'Ano', 'number')}
        {field('doi', 'DOI')}
      </div>
      {field('journal', 'Revista / Periódico')}
      <div style={row('1fr 1fr 1fr')}>
        {field('volume', 'Volume')}
        {field('issue', 'Edição (Issue)')}
        {field('pages', 'Páginas')}
      </div>
      <div style={row('2fr 1fr')}>
        {field('url', 'Disponível em (URL)')}
        {field('accessed', 'Acesso em', 'date')}
      </div>
    </>
  );
};
