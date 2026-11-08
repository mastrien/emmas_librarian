import React from 'react';
import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';
/** How the button takes the room of its row: its own width, the rest of the row, or the whole row. */
export type ButtonFill = 'none' | 'grow' | 'block';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fill?: ButtonFill;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

/**
 * The class list of a button; also for links and labels that must look like one.
 *
 * @example <Link className={buttonClassName({ variant: 'secondary' })} to="/settings">Configurações</Link>
 */
export function buttonClassName({ variant = 'secondary', size = 'md', fill = 'none' }: ButtonProps = {}): string {
  return [VARIANT_CLASS[variant], size === 'sm' && 'btn--sm', fill !== 'none' && `btn--${fill}`]
    .filter(Boolean)
    .join(' ');
}

/**
 * The app's button: the existing btn-* looks, with size and width as props instead of inline styles (Arca 134).
 * `type` defaults to "button", so a button inside a form never submits it by accident.
 *
 * @example <Button variant="primary" onClick={save}><Save size={16} /> Salvar</Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, fill, className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={[buttonClassName({ variant, size, fill }), className].filter(Boolean).join(' ')}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';
