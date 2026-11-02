import React from 'react';
import { X } from 'lucide-react';

/** A line inside the categories modal: a result, a failure, or a question with its two answers. */
export interface CategoriesNoticeContent {
  text: string;
  tone: 'done' | 'failed' | 'ask';
  /** For a question: the answer that goes ahead, e.g. "Acrescentar" or "Excluir". */
  confirmLabel?: string;
}

interface CategoriesNoticeProps {
  notice: CategoriesNoticeContent;
  onDismiss: () => void;
  onConfirm?: () => void;
}

/**
 * Says what happened, or asks first, inside the categories modal, where native alert/confirm dialogs used to
 * (the author prefers the app's own dialogs, validation of epic #44). A question is an alertdialog with
 * "Cancelar" and its confirm label; a result is a status with an X.
 *
 * @example <CategoriesNotice notice={{ text: '4 categorias criadas.', tone: 'done' }} onDismiss={clear} />
 */
export const CategoriesNotice: React.FC<CategoriesNoticeProps> = ({ notice, onDismiss, onConfirm }) => {
  if (notice.tone === 'ask') {
    return (
      <div role="alertdialog" aria-label={notice.text} className="categories-notice categories-notice--ask">
        <span>{notice.text}</span>
        <span className="categories-notice-actions">
          <button type="button" className="btn-secondary categories-small-button" onClick={onDismiss}>
            Cancelar
          </button>
          <button type="button" className="btn-primary categories-small-button" onClick={onConfirm}>
            {notice.confirmLabel ?? 'Confirmar'}
          </button>
        </span>
      </div>
    );
  }
  return (
    <div role="status" className={`categories-notice categories-notice--${notice.tone}`}>
      <span>{notice.text}</span>
      <button type="button" className="categories-icon-button" aria-label="Fechar aviso" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
};
