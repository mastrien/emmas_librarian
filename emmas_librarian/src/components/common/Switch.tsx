import React from 'react';
import './switch.css';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What the switch turns on or off; it is also the switch's accessible name. */
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * An on/off switch with its text, as the boards draw it (172, 173, 165): the native checkbox stays inside, hidden,
 * so the keyboard, the screen reader ("switch, on") and tests keep working, and the track and knob are styled by
 * the theme instead of the browser's white box that looked wrong in dark mode.
 *
 * @example <Switch checked={onlyPending} onChange={setOnlyPending}>Só pendentes</Switch>
 */
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, children, disabled = false, className }) => (
  <label className={['app-switch', className].filter(Boolean).join(' ')}>
    <input
      type="checkbox"
      role="switch"
      className="app-switch__input"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="app-switch__track" aria-hidden="true" />
    <span className="app-switch__text">{children}</span>
  </label>
);
