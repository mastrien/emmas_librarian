import React, { useLayoutEffect, useRef, useState } from 'react';
import type { ScreeningDecision, ScreeningLabel, ScreeningStage } from '../../types';
import './guided.css';

interface GuidedDecisionPanelProps {
  stage: ScreeningStage;
  options: ScreeningLabel[];
  duplicate: ScreeningLabel | null;
  decision: ScreeningDecision | null;
  onDecide: (label: ScreeningLabel, note: string) => void;
  onMove: (step: -1 | 1) => void;
  onUndo: () => void;
  /** What the AI suggests, at the stage that has suggestions (#54). */
  suggestion?: React.ReactNode;
  suggestedLabelId?: number | null;
  onSuggest?: () => void;
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT');

// The keys of the guided screening: 1-9 decide, D duplicate, ← → move, Z undo, S asks for a suggestion, N writes a note. While typing a
// note the keys type; Escape leaves the note.
function useGuidedKeys(
  props: GuidedDecisionPanelProps,
  note: string,
  noteRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  // Layout effect: the keys work from the moment the article is on screen, with no gap after the paint where a
  // key pressed at once would be lost.
  useLayoutEffect(() => {
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
      else if (e.key.toLowerCase() === 's') props.onSuggest?.();
      else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        noteRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props, note, noteRef]);
}

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => <kbd className="guided-key">{children}</kbd>;

/**
 * The decision side of the guided screening: one button per label of the stage (keys 1-9), the duplicate link at
 * title and abstract (D) and the note that goes with the decision (N). Rendered with key={article.id}, so the note
 * starts from the article's own.
 *
 * @example <GuidedDecisionPanel key={article.id} stage="title" options={options} … />
 */
export const GuidedDecisionPanel: React.FC<GuidedDecisionPanelProps> = (props) => {
  const { stage, options, duplicate, decision, onDecide, suggestion, suggestedLabelId } = props;
  const [note, setNote] = useState(decision?.note ?? '');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useGuidedKeys(props, note, noteRef);
  return (
    <aside aria-label="Decisão" className="review-section guided-decision">
      <strong>{stage === 'title' ? 'Decisão (título e resumo)' : 'Decisão (texto completo)'}</strong>
      {suggestion}
      {options.map((label, i) => (
        <button
          key={label.id}
          type="button"
          className="review-small guided-option"
          aria-pressed={decision?.label_id === label.id}
          onClick={() => onDecide(label, note)}
        >
          {i < 9 && <Key>{i + 1}</Key>}
          <span className={`review-dot review-dot--${label.kind}`} aria-hidden="true" />
          <span>{label.name}</span>
          {suggestedLabelId === label.id && <span className="review-suggested">sugerido</span>}
        </button>
      ))}
      {duplicate && (
        <button type="button" onClick={() => onDecide(duplicate, note)} className="guided-duplicate">
          {decision?.label_id === duplicate.id
            ? 'Marcado como duplicado (removido antes da triagem)'
            : 'É duplicado de outro artigo?'}{' '}
          <Key>D</Key>
        </button>
      )}
      <label className="review-muted guided-note">
        <span>
          <Key>N</Key> Nota (opcional, vai junto com a decisão)
        </span>
        <textarea
          ref={noteRef}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ex.: só usa radar, sem satélite"
          className="input-field"
        />
      </label>
      <p className="review-muted guided-hint">Decidir passa para o próximo artigo sem decisão nesta etapa.</p>
    </aside>
  );
};
