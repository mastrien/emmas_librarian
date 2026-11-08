import React, { useId } from 'react';
import { FieldFrame, controlA11y, controlClassName, type ControlFrameProps } from './FieldFrame';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectFieldProps = ControlFrameProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className' | 'children'> & {
    options: SelectOption[];
  };

/**
 * A labelled select with the app's look and its own arrow instead of the system's (design rule: styled controls).
 *
 * @example <SelectField label="Intervalo" value={days} onChange={(e) => setDays(e.target.value)} options={INTERVALS} />
 */
export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, hint, error, compact, id, frameClassName, options, ...select }, ref) => {
    const generated = useId();
    const controlId = id ?? generated;
    return (
      <FieldFrame id={controlId} label={label} hint={hint} error={error} compact={compact} className={frameClassName}>
        <select
          ref={ref}
          className={controlClassName(compact, 'select-field')}
          {...controlA11y(controlId, { hint, error })}
          {...select}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </FieldFrame>
    );
  },
);
SelectField.displayName = 'SelectField';
