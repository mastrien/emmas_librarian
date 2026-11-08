import React, { useState } from 'react';
import { Check, Pencil, Undo2, X } from 'lucide-react';
import type { InvestigationResult, ResultReview, ReviewStatus } from '../../../types';
import { aiAnswerText, REVIEW_LABELS, canSaveCorrection } from '../../../utils/investigationAnswers';
import './resultReview.css';

export interface ResultReviewControlsProps {
  result: InvestigationResult;
  onReview: (review: ResultReview) => Promise<void>;
}

// Shortcuts work while the answer block has focus (click it or Tab to it), never while typing in the edit box.
const SHORTCUTS: Record<string, 'accept' | 'edit' | 'reject'> = { a: 'accept', e: 'edit', r: 'reject' };

/**
 * Accept, edit or reject one AI answer (#47), with its review status always visible. Once an answer is marked,
 * the three give way to "Desfazer", which brings them back (validation of epic #44). Keys, while the answer is
 * unmarked: A accepts, E edits, R rejects; Esc leaves the edit box; Ctrl+Enter saves the edit.
 *
 * Usage:
 *   <ResultReviewControls result={result} onReview={(review) => reviewResult(result.id, review)} />
 */
export const ResultReviewControls: React.FC<ResultReviewControlsProps> = ({ result, onReview }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (review: ResultReview) => {
    setBusy(true);
    try {
      await onReview(review);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  const actions = {
    accept: () => send({ status: 'accepted' }),
    edit: () => setDraft(result.reviewed_answer ?? aiAnswerText(result)),
    reject: () => send({ status: 'rejected' }),
  };

  const marked = result.review_status !== 'pending';

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLTextAreaElement || busy || event.ctrlKey || event.metaKey || event.altKey) return;
    if (marked) return;
    const action = SHORTCUTS[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    void actions[action]();
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`Revisão da resposta: ${REVIEW_LABELS[result.review_status]}`}
      className="result-review"
    >
      <div className={`result-review-status result-review-status--${result.review_status satisfies ReviewStatus}`}>
        Revisão: {REVIEW_LABELS[result.review_status]}
      </div>
      {/* All under the status: sharing its line, two fit and the third fell alone onto the next (#84). */}
      <div role="group" aria-label="Ações da revisão" className="result-review-actions">
        {marked ? (
          <button
            type="button"
            className="btn-secondary result-review-button"
            disabled={busy}
            onClick={() => send({ status: 'pending' })}
          >
            <Undo2 size={14} /> Desfazer
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-secondary result-review-button"
              disabled={busy}
              onClick={actions.accept}
            >
              <Check size={14} /> Aceitar
            </button>
            <button type="button" className="btn-secondary result-review-button" disabled={busy} onClick={actions.edit}>
              <Pencil size={14} /> Editar
            </button>
            <button
              type="button"
              className="btn-secondary result-review-button"
              disabled={busy}
              onClick={actions.reject}
            >
              <X size={14} /> Rejeitar
            </button>
          </>
        )}
      </div>
      {result.review_status === 'edited' && draft === null && (
        <p className="result-review-answer">
          <strong>Sua resposta:</strong> {result.reviewed_answer}
        </p>
      )}
      {draft !== null && (
        <ReviewEditor
          draft={draft}
          initial={result.reviewed_answer ?? aiAnswerText(result)}
          busy={busy}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={() => send({ status: 'edited', answer: draft })}
        />
      )}
    </div>
  );
};

interface ReviewEditorProps {
  draft: string;
  /** The answer the edit started from: saving it unchanged is not a correction. */
  initial: string;
  busy: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const ReviewEditor: React.FC<ReviewEditorProps> = ({ draft, initial, busy, onChange, onCancel, onSave }) => (
  <div className="result-review-editor">
    <textarea
      className="input-field"
      aria-label="Sua resposta"
      autoFocus
      rows={4}
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSaveCorrection(draft, initial)) onSave();
      }}
    />
    <div className="result-review-editor-buttons">
      <button type="button" className="btn-secondary result-review-button" onClick={onCancel}>
        Cancelar
      </button>
      <button
        type="button"
        className="btn-primary result-review-button"
        disabled={busy || !canSaveCorrection(draft, initial)}
        onClick={onSave}
      >
        Salvar resposta
      </button>
    </div>
  </div>
);
