import React, { useEffect, useRef, useState } from 'react';
import type { ScreeningDecision, ScreeningLabel, ScreeningStage } from '../../types';

interface GuidedDecisionPanelProps {
  stage: ScreeningStage;
  options: ScreeningLabel[];
  duplicate: ScreeningLabel | null;
  decision: ScreeningDecision | null;
  onDecide: (label: ScreeningLabel, note: string) => void;
  onMove: (step: -1 | 1) => void;
  onUndo: () => void;
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT');

// The keys of the guided screening: 1-9 decide, D duplicate, ← → move, Z undo, N writes a note. While typing a
// note the keys type; Escape leaves the note.
function useGuidedKeys(
  props: GuidedDecisionPanelProps,
  note: string,
  noteRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (typing(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      const option = props.options[Number(e.key) - 1];
      if (option) props.onDecide(option, note);
      else if (e.key.toLowerCase() === 'd' && props.duplicate) props.onDecide(props.duplicate, note);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') props.onMove(e.key === 'ArrowLeft' ? -1 : 1);
      else if (e.key.toLowerCase() === 'z') props.onUndo();
      else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        noteRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props, note, noteRef]);
}

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    style={{
      fontSize: '0.75rem',
      minWidth: '22px',
      textAlign: 'center',
      padding: '0.1rem 0.35rem',
      border: '1px solid var(--border-color)',
      borderBottomWidth: '2px',
      borderRadius: '4px',
      background: 'var(--bg-main)',
    }}
  >
    {children}
  </kbd>
);

/**
 * The decision side of the guided screening: one button per label of the stage (keys 1-9), the duplicate link at
 * title and abstract (D) and the note that goes with the decision (N). Rendered with key={article.id}, so the note
 * starts from the article's own.
 *
 * @example <GuidedDecisionPanel key={article.id} stage="title" options={options} … />
 */
export const GuidedDecisionPanel: React.FC<GuidedDecisionPanelProps> = (props) => {
  const { stage, options, duplicate, decision, onDecide } = props;
  const [note, setNote] = useState(decision?.note ?? '');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useGuidedKeys(props, note, noteRef);
  return (
    <aside
      aria-label="Decisão"
      className="review-section"
      style={{
        flex: '1 1 320px',
        minWidth: '280px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <strong>{stage === 'title' ? 'Decisão (título e resumo)' : 'Decisão (texto completo)'}</strong>
      {options.map((label, i) => (
        <button
          key={label.id}
          type="button"
          className="review-small"
          aria-pressed={decision?.label_id === label.id}
          onClick={() => onDecide(label, note)}
          style={{
            justifyContent: 'flex-start',
            minHeight: '44px',
            outline: decision?.label_id === label.id ? '2px solid var(--color-primary)' : undefined,
          }}
        >
          {i < 9 && <Key>{i + 1}</Key>}
          <span className={`review-dot review-dot--${label.kind}`} aria-hidden="true" />
          <span>{label.name}</span>
        </button>
      ))}
      {duplicate && (
        <button
          type="button"
          onClick={() => onDecide(duplicate, note)}
          style={{
            alignSelf: 'flex-start',
            font: 'inherit',
            fontSize: '0.85rem',
            background: 'none',
            border: 0,
            padding: '0.35rem 0.1rem',
            color: 'var(--color-primary)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            cursor: 'pointer',
          }}
        >
          {decision?.label_id === duplicate.id
            ? 'Marcado como duplicado (removido antes da triagem)'
            : 'É duplicado de outro artigo?'}{' '}
          <Key>D</Key>
        </button>
      )}
      <label className="review-muted" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span>
          <Key>N</Key> Nota (opcional, vai junto com a decisão)
        </span>
        <textarea
          ref={noteRef}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ex.: só usa radar, sem satélite"
          style={{ font: 'inherit', padding: '0.5rem', resize: 'vertical' }}
        />
      </label>
      <p className="review-muted" style={{ margin: 0 }}>
        Decidir passa para o próximo artigo sem decisão nesta etapa.
      </p>
    </aside>
  );
};
