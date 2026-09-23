import React from 'react';
import type { VenueCategory } from '../../../types';
import { CATEGORY_OPTIONS, PRESET_COLORS, type VenueDetails } from './venueFormModel';

interface VenueDetailsFieldsProps {
  details: VenueDetails;
  onChange: (changes: Partial<VenueDetails>) => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.25rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-main)',
  color: 'var(--text-main)',
};

/**
 * Title, acronym, category, badge color and call URL of a venue.
 *
 * Usage:
 *   <VenueDetailsFields details={details} onChange={(changes) => setDetails({ ...details, ...changes })} />
 */
export const VenueDetailsFields: React.FC<VenueDetailsFieldsProps> = ({ details, onChange }) => (
  <>
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
      <div>
        <label style={labelStyle}>Título / Nome do Evento *</label>
        <input
          type="text"
          value={details.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Ex: Simpósio Brasileiro de BD"
          style={inputStyle}
          required
        />
      </div>
      <div>
        <label style={labelStyle}>Sigla</label>
        <input
          type="text"
          value={details.acronym}
          onChange={(e) => onChange({ acronym: e.target.value })}
          placeholder="Ex: SBBD 2026"
          style={inputStyle}
        />
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <div>
        <label style={labelStyle}>Categoria</label>
        <select
          value={details.category}
          onChange={(e) => onChange({ category: e.target.value as VenueCategory })}
          style={inputStyle}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <ColorPicker color={details.color} onChange={(color) => onChange({ color })} />
    </div>
    <div>
      <label style={labelStyle}>Link / URL da Chamada</label>
      <input
        type="url"
        value={details.url}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="https://..."
        style={inputStyle}
      />
    </div>
  </>
);

const ColorPicker: React.FC<{ color: string; onChange: (color: string) => void }> = ({ color, onChange }) => (
  <div>
    <label style={labelStyle}>Cor do Emblema</label>
    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', paddingTop: '0.25rem' }}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: c,
            border: color === c ? '2px solid var(--text-heading)' : 'none',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  </div>
);
