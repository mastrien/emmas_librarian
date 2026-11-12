import React, { useEffect, useState } from 'react';
import { Check, CircleHelp, X } from 'lucide-react';
import { QUICK_KINDS, quickLabel, type QuickKind } from './screeningFilter';
import type { ScreeningLabel } from '../../types';
import type { ReviewRow } from '../../utils/screeningView';
import { KINDS_BY_STAGE } from '../../utils/screeningPresets';
import { LabelMenu } from './LabelMenu';
import { ReviewArticleRow } from './ReviewArticleRow';
import { NumberedPages } from '../../components/common/NumberedPages';
import { usePagedRows } from '../../hooks/usePagedRows';
import { REVIEW_PAGE_SIZE } from './ReviewSections';

interface PendingListProps {
  rows: ReviewRow[];
  selection: Selection;
  labels: ScreeningLabel[];
  onPick: (rows: ReviewRow[], label: ScreeningLabel) => void;
}

/**
 * The selection mode of the pending list. Only rows still pending count as selected, so a decided article leaves the
 * selection by itself. The page owns it, because its button sits in the bar with the statuses (board 164).
 *
 * @example const selection = useSelection(view.pending); <PendingList rows={view.pending} selection={selection} … />
 */
export function useSelection(rows: ReviewRow[]) {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<Set<number>>(new Set());
  const selected = rows.filter((r) => ids.has(r.article.id));
  const toggle = (id: number) =>
    setIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const exit = () => {
    setSelecting(false);
    setIds(new Set());
  };
  const all = () => setIds(new Set(rows.map((r) => r.article.id)));
  return {
    selecting,
    selected,
    isSelected: (id: number) => ids.has(id),
    toggle,
    start: () => setSelecting(true),
    exit,
    all,
  };
}

export type Selection = ReturnType<typeof useSelection>;

const BatchBar: React.FC<{ selection: Selection; labels: ScreeningLabel[]; onPick: PendingListProps['onPick'] }> = ({
  selection,
  labels,
  onPick,
}) => {
  const count = selection.selected.length;
  return (
    <div className="review-batch" role="region" aria-label="Ações para os artigos selecionados">
      <strong aria-live="polite">
        {count === 0 ? 'Nenhum selecionado' : `${count} ${count === 1 ? 'selecionado' : 'selecionados'}`}
      </strong>
      <button type="button" className="review-small" onClick={selection.all}>
        Selecionar todos
      </button>
      <LabelMenu
        labels={labels}
        kinds={KINDS_BY_STAGE.title}
        currentLabelId={null}
        buttonText="Aplicar rótulo ▾"
        primary
        alignLeft
        disabled={count === 0}
        onPick={(label) => onPick(selection.selected, label)}
      />
      <span style={{ flex: 1 }} />
      <button type="button" className="review-quiet" onClick={selection.exit} aria-label="Sair da seleção">
        ✕
      </button>
    </div>
  );
};

/** The key that picks each quick decision while the pointer is over a row (board 164). */
export const QUICK_KEYS: Record<QuickKind, string> = { include: '1', maybe: '2', exclude: '3' };

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

// 1, 2 and 3 decide the row under the pointer, as the keys on the buttons say; typing in a field is left alone.
function useQuickKeys(row: ReviewRow | null, labels: ScreeningLabel[], onPick: PendingListProps['onPick']) {
  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const kind = QUICK_KINDS.find((q) => QUICK_KEYS[q.kind] === e.key)?.kind;
      const target = kind && quickLabel(labels, kind);
      if (target) onPick([row], target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [row, labels, onPick]);
}

const QUICK_ICONS: Record<QuickKind, React.ReactNode> = {
  include: <Check size={14} className="review-icon--include" aria-hidden="true" />,
  maybe: <CircleHelp size={14} className="review-icon--maybe" aria-hidden="true" />,
  exclude: <X size={14} className="review-icon--exclude" aria-hidden="true" />,
};

/**
 * Board 164: Incluir, Dúvida and Excluir on a pending row, each with the first label of its kind; they show on hover
 * or keyboard focus, and the label menu beside them keeps every other label.
 */
const QuickDecision: React.FC<{ row: ReviewRow; labels: ScreeningLabel[]; onPick: PendingListProps['onPick'] }> = ({
  row,
  labels,
  onPick,
}) => (
  <span className="review-quick">
    {QUICK_KINDS.map(({ kind, label }) => {
      const target = quickLabel(labels, kind);
      if (!target) return null;
      return (
        <button
          key={kind}
          type="button"
          className="review-small"
          title={`${label}: rótulo "${target.name}"`}
          aria-label={`${label} ${row.article.title}`}
          onClick={() => onPick([row], target)}
        >
          {QUICK_ICONS[kind]} {label}
          <kbd className="review-kbd">{QUICK_KEYS[kind]}</kbd>
        </button>
      );
    })}
  </span>
);

/**
 * "Sem decisão": the articles still to screen, one "Rótulo ▾" each, and a selection mode that applies one label to
 * many at once.
 *
 * @example <PendingList rows={view.pending} labels={labels} onPick={(rows, label) => decide(rows, label)} />
 */
export const PendingList: React.FC<PendingListProps> = ({ rows, selection, labels, onPick }) => {
  // "Selecionar todos" takes every pending article, not only this page.
  const paged = usePagedRows(rows, REVIEW_PAGE_SIZE);
  const [hovered, setHovered] = useState<ReviewRow | null>(null);
  useQuickKeys(selection.selecting ? null : hovered, labels, onPick);
  return (
    <>
      {selection.selecting && <BatchBar selection={selection} labels={labels} onPick={onPick} />}
      <div className="review-list">
        {paged.rows.map((row) => (
          <ReviewArticleRow
            key={row.article.id}
            row={row}
            onHover={(over) => setHovered((current) => (over ? row : current === row ? null : current))}
            selection={
              selection.selecting
                ? { checked: selection.isSelected(row.article.id), onToggle: () => selection.toggle(row.article.id) }
                : undefined
            }
            actions={
              <>
                {!selection.selecting && (
                  <span className="review-chip review-chip--none review-pending-badge">sem decisão</span>
                )}
                {!selection.selecting && <QuickDecision row={row} labels={labels} onPick={onPick} />}
                <LabelMenu
                  labels={labels}
                  kinds={KINDS_BY_STAGE.title}
                  currentLabelId={null}
                  buttonText="Rótulo ▾"
                  onPick={(label) => onPick([row], label)}
                />
              </>
            }
          />
        ))}
        {rows.length === 0 && <div className="review-empty">Todos os artigos já têm decisão.</div>}
      </div>
      {rows.length > 0 && (
        <div className="review-range">
          {(paged.page - 1) * REVIEW_PAGE_SIZE + 1}–{Math.min(paged.page * REVIEW_PAGE_SIZE, rows.length)} de{' '}
          {rows.length}
        </div>
      )}
      <NumberedPages label="Páginas de Sem decisão" page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </>
  );
};
