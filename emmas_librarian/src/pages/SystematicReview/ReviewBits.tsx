import React from 'react';
import type { ScreeningChange } from './useScreening';

/**
 * The toast after each decision, with "Desfazer".
 *
 * @example {lastChange && <UndoToast change={lastChange} />}
 */
export const UndoToast: React.FC<{ change: ScreeningChange }> = ({ change }) => (
  <div className="review-toast" role="status">
    <span>{change.text}</span>
    <button type="button" onClick={() => void change.undo()}>
      Desfazer
    </button>
  </div>
);
