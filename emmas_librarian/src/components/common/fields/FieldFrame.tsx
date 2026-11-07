import React from 'react';
import './fields.css';

export interface FieldFrameProps {
  /** The control's id, shared by the label and the hint/error it describes. */
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Shown instead of the hint, in the danger colour, and marks the control invalid. */
  error?: React.ReactNode;
  /** Lighter label and tighter control, for dense editors (citation metadata). */
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** What a control takes for its frame: the frame's props, an optional fixed id and a class for the frame. */
export type ControlFrameProps = Omit<FieldFrameProps, 'id' | 'children' | 'className'> & {
  id?: string;
  frameClassName?: string;
};

/** The id of the text under a control, for its aria-describedby. */
export const describedById = (id: string): string => `${id}-desc`;

/**
 * Label above, control, then a hint or an error below: the frame every form field of the app shares (Arca 134).
 * The controls (TextField, TextArea, SelectField) put themselves inside it.
 *
 * @example <FieldFrame id={id} label="Ano" hint="Quatro dígitos"><input id={id} /></FieldFrame>
 */
export const FieldFrame: React.FC<FieldFrameProps> = ({ id, label, hint, error, compact, className, children }) => {
  const note = error ?? hint;
  return (
    <div className={['field', compact && 'field--compact', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {note && (
        <span
          id={describedById(id)}
          className={error ? 'field-error' : 'field-hint'}
          role={error ? 'alert' : undefined}
        >
          {note}
        </span>
      )}
    </div>
  );
};

/**
 * The accessibility attributes a control gets from its frame: its id, and the hint or error as its description.
 *
 * @example <input {...controlA11y(id, { hint, error })} />
 */
export function controlA11y(id: string, props: Pick<FieldFrameProps, 'hint' | 'error'>) {
  return {
    id,
    'aria-invalid': props.error ? true : undefined,
    'aria-describedby': props.error || props.hint ? describedById(id) : undefined,
  };
}

/**
 * The class list of a control: the app's input look, compact when the frame is.
 *
 * @example controlClassName(true, 'select-field') // 'input-field field-control input-compact select-field'
 */
export const controlClassName = (compact: boolean | undefined, extra?: string): string =>
  ['input-field', 'field-control', compact && 'input-compact', extra].filter(Boolean).join(' ');
