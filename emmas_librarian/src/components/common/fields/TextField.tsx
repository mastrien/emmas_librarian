import React, { useId } from 'react';
import { FieldFrame, controlA11y, controlClassName, type ControlFrameProps } from './FieldFrame';

export type TextFieldProps = ControlFrameProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>;

/**
 * A labelled single-line input with the app's look. Every native input prop passes through.
 *
 * @example <TextField label="DOI" value={doi} onChange={(e) => setDoi(e.target.value)} hint="Sem https://doi.org/" />
 */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, compact, id, frameClassName, type = 'text', ...input }, ref) => {
    const generated = useId();
    const controlId = id ?? generated;
    return (
      <FieldFrame id={controlId} label={label} hint={hint} error={error} compact={compact} className={frameClassName}>
        <input
          ref={ref}
          type={type}
          className={controlClassName(compact)}
          {...controlA11y(controlId, { hint, error })}
          {...input}
        />
      </FieldFrame>
    );
  },
);
TextField.displayName = 'TextField';
