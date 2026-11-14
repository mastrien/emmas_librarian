import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ScreeningKind, ScreeningLabel } from '../../types';
import type { LabelGroup, ReviewRow } from '../../utils/screeningView';
import { archiveNoteFor } from '../../utils/screeningPresets';
import { LabelMenu } from './LabelMenu';
import { ReviewArticleRow } from './ReviewArticleRow';
import { NumberedPages } from '../../components/common/NumberedPages';
import { usePagedRows } from '../../hooks/usePagedRows';
import { KIND_WORD, articlesCount } from './reviewText';

const ALL_KINDS: readonly ScreeningKind[] = ['include', 'maybe', 'exclude', 'removed'];

// Each group pages on its own, so 50 included articles never hide those in doubt. Rendering every row of a large
// project at once froze the page (1245 articles at the validation of epic #44).
export const REVIEW_PAGE_SIZE = 50;

/** What a row of a section can do: change its label, or take its decision back. */
export interface RowActions {
  labels: ScreeningLabel[];
  onPick: (row: ReviewRow, label: ScreeningLabel) => void;
  onUndo: (row: ReviewRow) => void;
}

interface SectionShellProps {
  title: string;
  count: number;
  kind: ScreeningKind;
  word: string;
  open: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

const SectionShell: React.FC<SectionShellProps> = ({ title, count, kind, word, open, onToggle, extra, children }) => (
  <section className="review-section" aria-label={`${title} (${count})`}>
    <div className="review-section-head">
      <button type="button" className="review-section-toggle" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span className={`review-dot review-dot--${kind}`} aria-hidden="true" />
        <span>
          {title} ({count})
        </span>
        <span className="review-muted" style={{ fontWeight: 400 }}>
          {word}
        </span>
      </button>
      {extra}
    </div>
    {open && children}
  </section>
);

/**
 * A section of an inclusion or doubt label, collapsible, its articles indented under it.
 *
 * @example <LabelSection group={group} open onToggle={toggle} actions={actions} onCite={cite} />
 */
export const LabelSection: React.FC<{
  group: LabelGroup;
  open: boolean;
  onToggle: () => void;
  actions: RowActions;
  onCite?: () => void;
}> = ({ group, open, onToggle, actions, onCite }) => (
  <SectionShell
    title={group.label.name}
    count={group.rows.length}
    kind={group.label.kind}
    word={KIND_WORD[group.label.kind]}
    open={open}
    onToggle={onToggle}
    extra={
      onCite && (
        <button type="button" className="review-small" onClick={onCite}>
          Citação em massa
        </button>
      )
    }
  >
    <LabelRows group={group} actions={actions} />
  </SectionShell>
);

const LabelRows: React.FC<{ group: LabelGroup; actions: RowActions }> = ({ group, actions }) => {
  const paged = usePagedRows(group.rows, REVIEW_PAGE_SIZE);
  return (
    <>
      {paged.rows.map((row) => (
        <ReviewArticleRow
          key={row.article.id}
          row={row}
          nested="section"
          actions={
            <>
              <LabelMenu
                labels={actions.labels}
                kinds={ALL_KINDS}
                currentLabelId={group.label.id}
                buttonText="Rótulo ▾"
                onPick={(label) => actions.onPick(row, label)}
              />
              <button type="button" className="review-small" onClick={() => actions.onUndo(row)}>
                Desfazer decisão
              </button>
            </>
          }
        />
      ))}
      <NumberedPages
        label={`Páginas de ${group.label.name}`}
        page={paged.page}
        pages={paged.pages}
        onPage={paged.setPage}
      />
    </>
  );
};

const GROUP_NOTE: Partial<Record<ScreeningKind, string>> = {
  removed: 'removido antes da triagem: o PRISMA conta à parte, não como excluído',
};

const GroupRows: React.FC<{ name: string; rows: ReviewRow[]; actions: RowActions; labelled: boolean }> = ({
  name,
  rows,
  actions,
  labelled,
}) => {
  const paged = usePagedRows(rows, REVIEW_PAGE_SIZE);
  return (
    <>
      {paged.rows.map((row) => (
        <ReviewArticleRow
          key={row.article.id}
          row={row}
          nested="group"
          reason={
            labelled
              ? `Motivo: ${archiveNoteFor(row.label!.name, row.decision!.note)}`
              : `Nota de quando foi arquivado: ${row.article.archive_note || '—'}`
          }
          actions={
            <>
              <LabelMenu
                labels={actions.labels}
                kinds={ALL_KINDS}
                currentLabelId={row.label?.id ?? null}
                buttonText={labelled ? 'Trocar motivo ▾' : 'Dar rótulo ▾'}
                onPick={(label) => actions.onPick(row, label)}
              />
              {labelled && (
                <button type="button" className="review-small" onClick={() => actions.onUndo(row)}>
                  Desfazer exclusão
                </button>
              )}
            </>
          }
        />
      ))}
      <NumberedPages label={`Páginas de ${name}`} page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </>
  );
};

const GroupHead: React.FC<{ name: string; kind: ScreeningKind | 'none'; count: number; note?: string }> = ({
  name,
  kind,
  count,
  note,
}) => (
  <div className="review-group-head">
    <span className={`review-chip review-chip--${kind}`}>{name}</span>
    <span className="review-muted">{articlesCount(count)}</span>
    {note && <span className="review-muted">· {note}</span>}
  </div>
);

/**
 * "Excluídos": the exclusions grouped by label (duplicates last), then the articles archived on the project page
 * without a label, which stay out of the PRISMA diagram until they get one.
 */
export const ExcludedSection: React.FC<{
  groups: LabelGroup[];
  unlabeled: ReviewRow[];
  open: boolean;
  onToggle: () => void;
  actions: RowActions;
  /** "Removidos antes da triagem" lists its groups the same way (board 164). */
  title?: string;
  word?: string;
}> = ({ groups, unlabeled, open, onToggle, actions, title = 'Excluídos', word = 'arquivados no projeto' }) => {
  const count = groups.reduce((n, g) => n + g.rows.length, 0) + unlabeled.length;
  if (count === 0) return null;
  return (
    <SectionShell
      title={title}
      count={count}
      kind={groups[0]?.label.kind ?? 'exclude'}
      word={word}
      open={open}
      onToggle={onToggle}
    >
      {groups.map((group) => (
        <React.Fragment key={group.label.id}>
          <GroupHead
            name={group.label.name}
            kind={group.label.kind}
            count={group.rows.length}
            note={GROUP_NOTE[group.label.kind]}
          />
          <GroupRows name={group.label.name} rows={group.rows} actions={actions} labelled />
        </React.Fragment>
      ))}
      {unlabeled.length > 0 && (
        <>
          <GroupHead
            name="Arquivado no projeto (sem rótulo)"
            kind="none"
            count={unlabeled.length}
            note="só entra no diagrama do PRISMA depois de receber um rótulo"
          />
          <GroupRows name="Arquivado no projeto (sem rótulo)" rows={unlabeled} actions={actions} labelled={false} />
        </>
      )}
    </SectionShell>
  );
};
