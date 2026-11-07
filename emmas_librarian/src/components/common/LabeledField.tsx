import React from 'react';
import { TextArea, TextField } from './fields';

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

/**
 * Label + text input (or textarea) taking the value as a string, for the article metadata editors. Built on
 * TextField/TextArea (Arca 134), so it shares their look; new forms can use those directly.
 *
 * Usage:
 *   <LabeledField label="Autores" value={authors} onChange={setAuthors} hint="Separe com ;" />
 */
export const LabeledField: React.FC<LabeledFieldProps> = ({
  onChange,
  type = 'text',
  multiline = false,
  textareaHeight = '100px',
  ...shared
}) => {
  if (multiline) {
    return <TextArea {...shared} height={textareaHeight} onChange={(e) => onChange(e.target.value)} />;
  }
  return <TextField {...shared} type={type} onChange={(e) => onChange(e.target.value)} />;
};
