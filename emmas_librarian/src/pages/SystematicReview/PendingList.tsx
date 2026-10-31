import React, { useState } from 'react';
import type { ScreeningLabel } from '../../types';
import type { ReviewRow } from '../../utils/screeningView';
import { KINDS_BY_STAGE } from '../../utils/screeningPresets';
import { LabelMenu } from './LabelMenu';
import { ReviewArticleRow } from './ReviewArticleRow';

interface PendingListProps {
  rows: ReviewRow[];
  labels: ScreeningLabel[];
  onPick: (rows: ReviewRow[], label: ScreeningLabel) => void;
}

// Only rows still pending count as selected, so a decided article leaves the selection by itself.
function useSelection(rows: ReviewRow[]) {
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

type Selection = ReturnType<typeof useSelection>;

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

/**
 * "Sem decisão": the articles still to screen, one "Rótulo ▾" each, and a selection mode that applies one label to
 * many at once.
 *
 * @example <PendingList rows={view.pending} labels={labels} onPick={(rows, label) => decide(rows, label)} />
 */
export const PendingList: React.FC<PendingListProps> = ({ rows, labels, onPick }) => {
  const selection = useSelection(rows);
  const read = rows.filter((r) => r.article.status === 'read').length;
  return (
    <>
      <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.15rem' }}>Sem decisão</h2>
      {selection.selecting ? (
        <BatchBar selection={selection} labels={labels} onPick={onPick} />
      ) : (
        <div className="review-list-head">
          <span className="review-muted">
            {rows.length} {rows.length === 1 ? 'artigo' : 'artigos'} sem decisão ({read} já lidos no projeto)
          </span>
          <button type="button" className="review-small" onClick={selection.start} disabled={rows.length === 0}>
            Selecionar
          </button>
        </div>
      )}
      <div className="review-list">
        {rows.map((row) => (
          <ReviewArticleRow
            key={row.article.id}
            row={row}
            selection={
              selection.selecting
                ? { checked: selection.isSelected(row.article.id), onToggle: () => selection.toggle(row.article.id) }
                : undefined
            }
            actions={
              <LabelMenu
                labels={labels}
                kinds={KINDS_BY_STAGE.title}
                currentLabelId={null}
                buttonText="Rótulo ▾"
                onPick={(label) => onPick([row], label)}
              />
            }
          />
        ))}
        {rows.length === 0 && <div className="review-empty">Todos os artigos já têm decisão.</div>}
      </div>
    </>
  );
};
