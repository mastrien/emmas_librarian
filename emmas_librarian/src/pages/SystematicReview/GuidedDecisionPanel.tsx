import React, { useLayoutEffect, useRef, useState } from 'react';
import { isTextEntry } from '../../utils/isTextEntry';
import { labelForKey, optionKeys } from './decisionKeys';
import { CircleCheck, CircleHelp, CircleX } from 'lucide-react';
import type { ScreeningDecision, ScreeningLabel } from '../../types';
import './guided.css';

interface GuidedDecisionPanelProps {
  options: ScreeningLabel[];
  duplicate: ScreeningLabel | null;
  decision: ScreeningDecision | null;
  onDecide: (label: ScreeningLabel, note: string) => void;
  onMove: (step: -1 | 1) => void;
  onUndo: () => void;
  /** Whether there is an article before this one, one after it, and a decision to take back (they enable the footer). */
  canGoBack: boolean;
  canGoOn: boolean;
  canUndo: boolean;
  /** What the AI suggests, at the stage that has suggestions (#54). */
  suggestion?: React.ReactNode;
  suggestedLabelId?: number | null;
  onSuggest?: () => void;
}

const typing = isTextEntry;

// The keys of the guided screening: A includes, E marks a doubt and R excludes (the audit's keys; further labels of a
// kind are numbered 1-9), D duplicate, ← → move, Z undo, S asks for a suggestion, N writes a note. While typing a
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
      const option = labelForKey(props.options, e.key);
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

// The round icon of each kind of label, as the board draws them.
const KIND_ICONS: Partial<Record<ScreeningLabel['kind'], React.ReactNode>> = {
  include: <CircleCheck size={18} aria-hidden="true" />,
  maybe: <CircleHelp size={18} aria-hidden="true" />,
  exclude: <CircleX size={18} aria-hidden="true" />,
};

/**
 * The decision side of the guided screening (board 165): one button per label of the stage, coloured by its kind and
 * with its key (A, E, R, or a number for further labels) at the end, the note that goes with the decision (N), the duplicate link at title and abstract
 * (D), the AI's suggestion and the way to move on: before, undo and skip. Rendered with key={article.id}, so the note
 * starts from the article's own.
 *
 * @example <GuidedDecisionPanel key={article.id} options={options} canGoBack canGoOn canUndo … />
 */
export const GuidedDecisionPanel: React.FC<GuidedDecisionPanelProps> = (props) => {
  const { options, duplicate, decision, onDecide, suggestion, suggestedLabelId } = props;
  const keys = optionKeys(options);
  const [note, setNote] = useState(decision?.note ?? '');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useGuidedKeys(props, note, noteRef);
  return (
    <aside aria-label="Decisão" className="guided-decision">
      <div className="guided-decision__body">
        <h2 className="guided-decision__title">Sua decisão</h2>
        {options.map((label) => (
          <button
            key={label.id}
            type="button"
            className={`guided-option guided-option--${label.kind}`}
            aria-pressed={decision?.label_id === label.id}
            onClick={() => onDecide(label, note)}
          >
            {KIND_ICONS[label.kind] ?? <span className={`review-dot review-dot--${label.kind}`} aria-hidden="true" />}
            <span>{label.name}</span>
            {suggestedLabelId === label.id && <span className="review-suggested">sugerido</span>}
            {keys.has(label.id) && <Key>{keys.get(label.id)!.toUpperCase()}</Key>}
          </button>
        ))}
        <label className="guided-note">
          <span className="guided-note__label">
            Nota <span className="guided-note__hint">(vai junto com a decisão)</span>
            <Key>N</Key>
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
        {duplicate && (
          <button type="button" onClick={() => onDecide(duplicate, note)} className="guided-duplicate">
            {decision?.label_id === duplicate.id
              ? 'Marcado como duplicado (removido antes da triagem)'
              : 'É duplicado de outro artigo?'}{' '}
            <Key>D</Key>
          </button>
        )}
        {suggestion}
      </div>
      <div className="guided-decision__foot">
        <div className="guided-decision__nav">
          <button
            type="button"
            className="btn-ghost btn--sm"
            onClick={() => props.onMove(-1)}
            disabled={!props.canGoBack}
          >
            ← Anterior
          </button>
          <button type="button" className="btn-ghost btn--sm" onClick={props.onUndo} disabled={!props.canUndo}>
            Desfazer <Key>Z</Key>
          </button>
          <button
            type="button"
            className="btn-secondary btn--sm guided-decision__skip"
            onClick={() => props.onMove(1)}
            disabled={!props.canGoOn}
          >
            Pular →
          </button>
        </div>
        <p className="guided-hint">Decidir já leva ao próximo pendente.</p>
      </div>
    </aside>
  );
};
