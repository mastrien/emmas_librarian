import React, { useState } from 'react';
import { Check, Pencil, Undo2, X } from 'lucide-react';
import type { InvestigationResult, ResultReview, ReviewStatus } from '../../../types';
import { aiAnswerText, REVIEW_LABELS, canSaveCorrection } from '../../../utils/investigationAnswers';

export interface ResultReviewControlsProps {
  result: InvestigationResult;
  onReview: (review: ResultReview) => Promise<void>;
}

const BADGE_COLORS: Record<ReviewStatus, string> = {
  pending: 'var(--color-warning, #f59e0b)',
  accepted: 'var(--color-success, #10b981)',
  edited: 'var(--color-primary)',
  rejected: 'var(--color-danger, #ef4444)',
};

const smallButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  fontSize: '0.8rem',
  padding: '0.25rem 0.55rem',
};

// Shortcuts work while the answer block has focus (click it or Tab to it), never while typing in the edit box.
const SHORTCUTS: Record<string, 'accept' | 'edit' | 'reject'> = { a: 'accept', e: 'edit', r: 'reject' };

/**
 * Accept, edit or reject one AI answer (#47), with its review status always visible. Keys: A accepts, E edits,
 * R rejects, Esc leaves the edit box; Ctrl+Enter saves the edit.
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

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLTextAreaElement || busy || event.ctrlKey || event.metaKey || event.altKey) return;
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
      style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border-color)', outlineOffset: '2px' }}
    >
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: BADGE_COLORS[result.review_status] }}>
          Revisão: {REVIEW_LABELS[result.review_status]}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn-secondary" style={smallButton} disabled={busy} onClick={actions.accept}>
          <Check size={14} /> Aceitar
        </button>
        <button type="button" className="btn-secondary" style={smallButton} disabled={busy} onClick={actions.edit}>
          <Pencil size={14} /> Editar
        </button>
        <button type="button" className="btn-secondary" style={smallButton} disabled={busy} onClick={actions.reject}>
          <X size={14} /> Rejeitar
        </button>
        {result.review_status !== 'pending' && (
          <button
            type="button"
            className="btn-secondary"
            style={smallButton}
            disabled={busy}
            onClick={() => send({ status: 'pending' })}
          >
            <Undo2 size={14} /> Desfazer
          </button>
        )}
      </div>
      {result.review_status === 'edited' && draft === null && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
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
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
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
    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
      <button type="button" className="btn-secondary" style={smallButton} onClick={onCancel}>
        Cancelar
      </button>
      <button
        type="button"
        className="btn-primary"
        style={smallButton}
        disabled={busy || !canSaveCorrection(draft, initial)}
        onClick={onSave}
      >
        Salvar resposta
      </button>
    </div>
  </div>
);
