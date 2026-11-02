import React from 'react';
import type { InvestigationResult, ResultReview } from '../../../types';
import { aiAnswerText, canSaveCorrection } from '../../../utils/investigationAnswers';

export interface AuditVerdictProps {
  result: InvestigationResult;
  /** The edit box is open; the parent owns it so the E key can open it too. */
  editing: boolean;
  onEdit: (open: boolean) => void;
  onReview: (review: ResultReview) => void;
}

/**
 * Correct / Fix / Wrong for one sampled answer (accepted / edited / rejected in the review of #47), with the edit box
 * for a fix and a way to undo. The keys A, E and R are handled by the screen around it.
 *
 * Usage:
 *   <AuditVerdict result={r} editing={editing} onEdit={setEditing} onReview={(v) => review(r.id, v)} />
 */
export const AuditVerdict: React.FC<AuditVerdictProps> = ({ result, editing, onEdit, onReview }) => {
  const save = (draft: string) => {
    if (!draft.trim()) return;
    onReview({ status: 'edited', answer: draft });
    onEdit(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="audit-verdict">
        <button
          type="button"
          className="btn-secondary ok"
          aria-pressed={result.review_status === 'accepted'}
          onClick={() => onReview({ status: 'accepted' })}
        >
          Correto <span className="audit-kbd">A</span>
        </button>
        <button
          type="button"
          className="btn-secondary fix"
          aria-pressed={result.review_status === 'edited'}
          onClick={() => onEdit(true)}
        >
          Corrigir <span className="audit-kbd">E</span>
        </button>
        <button
          type="button"
          className="btn-secondary bad"
          aria-pressed={result.review_status === 'rejected'}
          onClick={() => onReview({ status: 'rejected' })}
        >
          Incorreto <span className="audit-kbd">R</span>
        </button>
      </div>
      {editing && (
        <FixBox
          key={result.id}
          initial={result.reviewed_answer ?? aiAnswerText(result)}
          onSave={save}
          onCancel={() => onEdit(false)}
        />
      )}
      {!editing && result.review_status !== 'pending' && (
        <button
          type="button"
          className="btn-secondary"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => onReview({ status: 'pending' })}
        >
          Desfazer marcação
        </button>
      )}
    </div>
  );
};

interface FixBoxProps {
  initial: string;
  onSave: (draft: string) => void;
  onCancel: () => void;
}

// Mounted when "Corrigir" opens, so the draft starts from the current answer without syncing state in an effect.
const FixBox: React.FC<FixBoxProps> = ({ initial, onSave, onCancel }) => {
  const [draft, setDraft] = React.useState(initial);
  const canSave = canSaveCorrection(draft, initial);
  return (
    <>
      <textarea
        className="input-field"
        aria-label="Resposta corrigida"
        rows={3}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSave) onSave(draft);
        }}
      />
      <div className="audit-row">
        <button type="button" className="btn-primary" disabled={!canSave} onClick={() => onSave(draft)}>
          Salvar correção
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </>
  );
};
