import React, { type ReactNode } from 'react';

interface ModalFooterProps {
  /** Small muted text at the left: a shortcut, or what the action does ("Arraste para reordenar"). */
  hint?: ReactNode;
  /** Buttons that leave the bar's tinted background: the questions and notices of the app (board 181). */
  plain?: boolean;
  /** The buttons, which go to the right; a button that must stay left (an alternative) can come first. */
  children: ReactNode;
}

/**
 * The bottom bar of a window (board 175 and the ones after it): a tinted strip with a line above it that spans the
 * whole window, a hint at the left and the buttons at the right. It sticks to the bottom while the window scrolls.
 *
 * @example <ModalFooter hint="Ctrl Enter salva"><Button onClick={close}>Cancelar</Button><Button variant="primary">Salvar</Button></ModalFooter>
 */
export const ModalFooter: React.FC<ModalFooterProps> = ({ hint, plain = false, children }) => (
  <div className={plain ? 'app-modal-foot is-plain' : 'app-modal-foot'}>
    {hint && <span className="app-modal-foot__hint">{hint}</span>}
    <div className="app-modal-foot__actions">{children}</div>
  </div>
);
