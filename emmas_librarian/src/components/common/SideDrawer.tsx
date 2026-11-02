import React, { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './sideDrawer.css';

interface SideDrawerProps {
  side: 'left' | 'right';
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A side panel over the whole interface: fixed, full height, darkening the rest, closed by its X, by clicking
 * outside or with Esc. It is portaled to the body, so no scrolling or transformed ancestor can clip it.
 *
 * @example <SideDrawer side="right" label="Resposta selecionada" onClose={close}>…</SideDrawer>
 */
export const SideDrawer: React.FC<SideDrawerProps> = ({ side, label, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <>
      <button type="button" className="side-drawer-scrim" aria-label={`Fechar: ${label}`} onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={label} className={`side-drawer side-drawer--${side}`}>
        <button type="button" className="side-drawer-close" aria-label="Fechar" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
        {children}
      </aside>
    </>,
    document.body,
  );
};
