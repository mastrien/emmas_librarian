import React, { useId } from 'react';
import { FieldFrame, controlA11y, controlClassName, type ControlFrameProps } from './FieldFrame';

export type TextAreaProps = ControlFrameProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className' | 'style'> & {
    /** Fixed height (e.g. "100px"); without it the textarea follows `rows`. */
    height?: string;
  };

/**
 * A labelled textarea with the app's look; it does not resize, so dialogs keep their layout.
 *
 * @example <TextArea label="Resumo" value={abstract} onChange={(e) => setAbstract(e.target.value)} height="120px" />
 */
export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, hint, error, compact, id, frameClassName, height, ...textarea }, ref) => {
    const generated = useId();
    const controlId = id ?? generated;
    // The height is the caller's value, so it travels as a CSS variable, not as an inline style rule.
    const sized = height ? ({ '--field-height': height } as React.CSSProperties) : undefined;
    return (
      <FieldFrame id={controlId} label={label} hint={hint} error={error} compact={compact} className={frameClassName}>
        <textarea
          ref={ref}
          className={controlClassName(compact, 'field-textarea')}
          style={sized}
          {...controlA11y(controlId, { hint, error })}
          {...textarea}
        />
      </FieldFrame>
    );
  },
);
TextArea.displayName = 'TextArea';
