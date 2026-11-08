import React, { useId } from 'react';
import './aiSettings.css';

/**
 * Numeric RAG tuning parameter (chunk size, overlap, top K).
 *
 * Usage:
 *   <NumberSetting label="Overlap (caracteres)" value={overlap} onChange={setOverlap} />
 */
export const NumberSetting: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({
  label,
  value,
  onChange,
}) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="settings-small-label">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field settings-input"
      />
    </div>
  );
};
