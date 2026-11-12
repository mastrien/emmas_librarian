import React, { useId } from 'react';
import type { VenueCategory } from '../../../types';
import { SegmentedControl } from '../../common/SegmentedControl';
import { CATEGORY_OPTIONS, PRESET_COLORS, type VenueDetails } from './venueFormModel';
import './venueForm.css';

interface VenueDetailsFieldsProps {
  details: VenueDetails;
  onChange: (changes: Partial<VenueDetails>) => void;
}

const FieldText: React.FC<{
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'url';
  required?: boolean;
  mono?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', required, mono }) => {
  const id = useId();
  return (
    <div className="venue-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className={mono ? 'input-field venue-field__mono' : 'input-field'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
};

const ColorPicker: React.FC<{ color: string; onChange: (color: string) => void }> = ({ color, onChange }) => (
  <div className="venue-field">
    <span className="venue-field__label">Cor do emblema</span>
    <div className="venue-colors">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Cor ${c}`}
          aria-pressed={color === c}
          className="venue-color"
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  </div>
);

/**
 * The event's own fields (board 180): name and acronym, the kind as a segmented control, the badge colour and the
 * call's address.
 *
 * Usage:
 *   <VenueDetailsFields details={details} onChange={(changes) => setDetails({ ...details, ...changes })} />
 */
export const VenueDetailsFields: React.FC<VenueDetailsFieldsProps> = ({ details, onChange }) => (
  <>
    <div className="venue-row">
      <FieldText
        label="Nome do evento *"
        value={details.title}
        onChange={(title) => onChange({ title })}
        placeholder="Ex: Simpósio Brasileiro de BD"
        required
      />
      <FieldText
        label="Sigla"
        value={details.acronym}
        onChange={(acronym) => onChange({ acronym })}
        placeholder="Ex: SBBD 2026"
      />
    </div>
    <div className="venue-field">
      <span className="venue-field__label">Tipo</span>
      <SegmentedControl<VenueCategory>
        label="Tipo do evento"
        value={details.category}
        onChange={(category) => onChange({ category })}
        options={CATEGORY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
      />
    </div>
    <ColorPicker color={details.color} onChange={(color) => onChange({ color })} />
    <FieldText
      label={
        <>
          Site <span className="venue-field__optional">(opcional)</span>
        </>
      }
      value={details.url}
      onChange={(url) => onChange({ url })}
      placeholder="https://..."
      type="url"
      mono
    />
  </>
);
