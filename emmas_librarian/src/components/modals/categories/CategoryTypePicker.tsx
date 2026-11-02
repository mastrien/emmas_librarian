import React from 'react';
import { CATEGORY_TYPE_CHOICES } from './categoryText';

/**
 * The type picker of the categories modal, for a new category and for one being edited. 190px fits
 * "Múltipla Escolha" without cutting it (it was 150px).
 *
 * @example <CategoryTypePicker value={type} label="Tipo da nova categoria" onChange={setType} />
 */
export const CategoryTypePicker: React.FC<{ value: string; label: string; onChange: (type: string) => void }> = ({
  value,
  label,
  onChange,
}) => (
  <select
    className="input-field"
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{ width: '190px', flex: 'none' }}
  >
    {CATEGORY_TYPE_CHOICES.map((t) => (
      <option key={t.value} value={t.value}>
        {t.label}
      </option>
    ))}
  </select>
);
