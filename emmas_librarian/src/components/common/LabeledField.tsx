import React, { useId } from 'react';

interface LabeledFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  name?: string;
  type?: 'text' | 'number' | 'date' | 'url';
  placeholder?: string;
  required?: boolean;
  hint?: React.ReactNode;
  /** Renders a textarea instead of a single-line input. */
  multiline?: boolean;
  textareaHeight?: string;
  /** Lighter label and tighter padding, used by dense metadata editors. */
  compact?: boolean;
}

const labelStyle = (compact: boolean): React.CSSProperties => ({
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: compact ? undefined : 600,
  marginBottom: '0.3rem',
  color: 'var(--text-muted)',
});

const controlStyle = (compact: boolean, multiline: boolean, textareaHeight: string): React.CSSProperties => ({
  width: '100%',
  padding: compact ? '0.5rem' : '0.6rem 0.8rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-surface)',
  color: 'var(--text-main)',
  ...(compact ? {} : { outline: 'none', fontFamily: 'inherit' }),
  ...(multiline ? { height: textareaHeight, resize: 'none' } : {}),
});

const hintStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  marginTop: '0.25rem',
  lineHeight: '1.2',
};

/**
 * Label + text input (or textarea) with the app's form styling and an optional hint below.
 *
 * Usage:
 *   <LabeledField label="Autores" value={authors} onChange={setAuthors} hint="Separe com ;" />
 */
export const LabeledField: React.FC<LabeledFieldProps> = ({
  label,
  value,
  onChange,
  name,
  type = 'text',
  placeholder,
  required,
  hint,
  multiline = false,
  textareaHeight = '100px',
  compact = false,
}) => {
  const id = useId();
  const common = {
    id,
    name,
    value,
    placeholder,
    required,
    style: controlStyle(compact, multiline, textareaHeight),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  return (
    <div>
      <label htmlFor={id} style={labelStyle(compact)}>
        {label}
      </label>
      {multiline ? <textarea {...common} /> : <input type={type} {...common} />}
      {hint && <span style={hintStyle}>{hint}</span>}
    </div>
  );
};
