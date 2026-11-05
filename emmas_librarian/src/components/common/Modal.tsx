import React, { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './modal.css';

interface ModalProps {
  /** The name a screen reader gives the window. */
  label: string;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  /** The X's name, when "Fechar" says too little about what closing does. */
  closeLabel?: string;
  /** While something runs, the window cannot be closed. */
  busy?: boolean;
  /** Widest the window gets, in pixels; it never passes the screen. */
  width?: number;
  /** Extra classes on the window, for styles of the page it belongs to (portaled, it leaves the page). */
  className?: string;
  children: ReactNode;
}

/**
 * The app's window over the whole screen: the dark backdrop covers everything, the window is padded, closes with its X
 * or Esc, and scrolls inside when tall. Every modal is built from this one, so none is hand-rolled: two that were broke
 * at the validation of epic #44, one without padding and one pinned to a corner by a class name collision.
 *
 * @example <Modal label="Rótulos" title="Rótulos de triagem" onClose={close}>…</Modal>
 */
export const Modal: React.FC<ModalProps> = (props) => {
  const { label, title, description, onClose, closeLabel = 'Fechar', busy = false, width = 620, className } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return createPortal(
    <div className="app-modal-overlay" data-testid="app-modal-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={['card', 'fade-in', 'app-modal', className].filter(Boolean).join(' ')}
        style={{ width: `${width}px`, maxWidth: '100%' }}
      >
        <div className="app-modal-head">
          <div className="app-modal-titles">
            <h2 className="app-modal-title">{title}</h2>
            {description && <p className="app-modal-description">{description}</p>}
          </div>
          <button type="button" className="app-modal-x" aria-label={closeLabel} disabled={busy} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {props.children}
      </div>
    </div>,
    document.body,
  );
};
