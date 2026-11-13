import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Info, ListChecks, Play, SquareCheckBig, Tag } from 'lucide-react';
import type { Article, ScreeningLabel, ScreeningStage } from '../../types';
import { buildReview, type ReviewRow } from '../../utils/screeningView';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { MassCitationModal } from '../../components/modals/MassCitationModal';
import { useScreening, type ScreeningState } from './useScreening';
import { ExcludedSection, LabelSection, type RowActions } from './ReviewSections';
import { PendingList, useSelection, type Selection } from './PendingList';
import { UndoToast } from './ReviewBits';
import { ScreeningStatusFilter } from './ScreeningStatusFilter';
import { defaultFilter, filterCount, type ScreeningFilter } from './screeningFilter';
import { useSessionState } from '../../hooks/useSessionState';
import { ManageLabelsModal } from './ManageLabelsModal';
import { PrismaTab } from './prisma/PrismaTab';
import { CriteriaModal } from './CriteriaModal';
import { usePageCommands } from '../../components/common/shell/palette/PageCommandsContext';
import { EvaluationTab } from './EvaluationTab';
import { SimulationSection } from './SimulationSection';
import './review.css';
import './screeningList.css';
import { PageHeader } from '../../components/common/PageHeader';
import { ProjectNavPortal } from '../../components/common/shell/projectNavSlot';
import { ReviewNavList, type ReviewTab } from './ReviewNavList';

// Sections start open, except those the person closed during this visit.
function useOpenSections() {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const isOpen = (key: string) => !closed.has(key);
  const toggle = (key: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return { isOpen, toggle };
}

const STAGE_OPTIONS: { value: ScreeningStage; label: string }[] = [
  { value: 'title', label: 'Título e resumo' },
  { value: 'full', label: 'Texto completo' },
];

// A decision made from the list goes to the stage the list is showing (board 164).
function rowActions(screening: ScreeningState, stage: ScreeningStage): RowActions {
  return {
    labels: screening.labels,
    onPick: (row: ReviewRow, label: ScreeningLabel) =>
      void screening.decide([row.article.id], label.id, stage, row.decision?.note),
    onUndo: (row: ReviewRow) => row.decision && void screening.undecide([row.article.id], row.decision.stage),
  };
}

interface ReviewHeaderProps {
  projectId: number;
  tab: ReviewTab;
  counts: ScreeningState['view']['counts'];
  stage: ScreeningStage;
  onManageLabels: () => void;
  onWriteCriteria: () => void;
}

// What each part of the review says under its title (boards 164, 166, 167).
const decidedLine = (counts: ReviewHeaderProps['counts'], stage: ScreeningStage) => {
  const decided = counts.include + counts.maybe + counts.exclude;
  const by = stage === 'full' ? 'texto completo' : 'título e resumo';
  return `${decided} de ${decided + counts.pending} decididos por ${by}`;
};

const EVALUATION_NOTE =
  'Compara as sugestões da IA com as suas decisões. A IA nunca vê as suas decisões: só título, resumo e critérios.';

/** The page's header for each part (boards 164-167); the actions of the screening stay on the screening and the diagram. */
const ReviewHeader: React.FC<ReviewHeaderProps> = ({
  projectId,
  tab,
  counts,
  stage,
  onManageLabels,
  onWriteCriteria,
}) => {
  const titles: Record<ReviewTab, { eyebrow: string; title: string; subtitle?: string }> = {
    screening: { eyebrow: 'Revisão sistemática · PRISMA 2020', title: 'Triagem', subtitle: decidedLine(counts, stage) },
    prisma: { eyebrow: 'Revisão sistemática', title: 'Diagrama PRISMA 2020' },
    evaluation: {
      eyebrow: 'Revisão sistemática',
      title: 'Avaliar sugestões',
      subtitle: EVALUATION_NOTE,
    },
  };
  const { eyebrow, title, subtitle } = titles[tab];
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      actions={
        tab === 'evaluation' ? undefined : (
          <>
            <button type="button" className="btn-ghost" onClick={onWriteCriteria}>
              <ListChecks size={16} aria-hidden="true" /> Critérios
            </button>
            {/* The name keeps "Gerenciar" for screen readers; the canvas shows the short label. */}
            <button type="button" className="btn-ghost" onClick={onManageLabels} aria-label="Gerenciar rótulos">
              <Tag size={16} aria-hidden="true" /> Rótulos
            </button>
            <Link to={`/projects/${projectId}/review/guided`} className="btn-primary">
              <Play size={16} aria-hidden="true" /> Iniciar triagem guiada
            </Link>
          </>
        )
      }
    />
  );
};

interface FilteredListProps {
  screening: ScreeningState;
  selection: Selection;
  filter: ScreeningFilter;
  stage: ScreeningStage;
  onCite: (articles: Article[]) => void;
}

/** The list of the chosen status: the undecided articles, or the label sections of that kind. */
const FilteredList: React.FC<FilteredListProps> = ({ screening, selection, filter, stage, onCite }) => {
  const sections = useOpenSections();
  const actions = rowActions(screening, stage);
  const { view } = screening;
  if (filter === 'pending') {
    return (
      <PendingList
        rows={view.pending}
        selection={selection}
        labels={screening.labels}
        onPick={(rows, label) =>
          void screening.decide(
            rows.map((r) => r.article.id),
            label.id,
            stage,
          )
        }
      />
    );
  }
  if (filter === 'exclude' || filter === 'removed') {
    const removed = filter === 'removed';
    return (
      <ExcludedSection
        groups={view.excluded.filter((g) => g.label.kind === filter)}
        unlabeled={removed ? [] : view.unlabeled}
        open={sections.isOpen(filter)}
        onToggle={() => sections.toggle(filter)}
        actions={actions}
        title={removed ? 'Removidos antes da triagem' : 'Excluídos'}
        word={removed ? 'o PRISMA conta à parte' : 'arquivados no projeto'}
      />
    );
  }
  return (
    <>
      {view.sections
        .filter((group) => group.label.kind === filter)
        .map((group) => (
          <LabelSection
            key={group.label.id}
            group={group}
            open={sections.isOpen(`label-${group.label.id}`)}
            onToggle={() => sections.toggle(`label-${group.label.id}`)}
            actions={actions}
            onCite={group.label.kind === 'include' ? () => onCite(group.rows.map((r) => r.article)) : undefined}
          />
        ))}
    </>
  );
};

/**
 * The screening (board 164): the statuses with their counts as one control, the chosen one's list under it, and
 * the note that an exclusion archives the article in the project.
 */
interface ReviewBodyProps {
  projectId: number;
  screening: ScreeningState;
  stage: ScreeningStage;
  onStageChange: (stage: ScreeningStage) => void;
  onCite: (articles: Article[]) => void;
}

const ReviewBody: React.FC<ReviewBodyProps> = ({ projectId, screening, stage, onStageChange, onCite }) => {
  const { counts } = screening.view;
  const [stored, setFilter] = useSessionState<ScreeningFilter | null>(`review.${projectId}.filter`, null);
  const filter = stored ?? defaultFilter(counts);
  const selection = useSelection(screening.view.pending);
  const decided = counts.include + counts.maybe + counts.exclude;
  const total = decided + counts.pending;
  return (
    <div className="review-screening">
      <div className="review-bar">
        <ScreeningStatusFilter counts={counts} value={filter} onChange={setFilter} />
        <SegmentedControl<ScreeningStage>
          label="Etapa"
          options={STAGE_OPTIONS}
          value={stage}
          onChange={onStageChange}
        />
        {filter === 'pending' && !selection.selecting && (
          <button
            type="button"
            className="btn-secondary btn--sm review-bar__select"
            onClick={selection.start}
            disabled={counts.pending === 0}
          >
            <SquareCheckBig size={14} aria-hidden="true" /> Selecionar vários
          </button>
        )}
      </div>
      <div
        className="review-progress"
        role="progressbar"
        aria-label="Triagem decidida"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={decided}
      >
        <i style={{ width: `${total === 0 ? 0 : (decided / total) * 100}%` }} />
      </div>
      <FilteredList screening={screening} selection={selection} filter={filter} stage={stage} onCite={onCite} />
      {filterCount(counts, filter) === 0 && filter !== 'pending' && (
        <div className="review-empty">Nenhum artigo com este status.</div>
      )}
      <p className="review-footnote">
        <Info size={14} aria-hidden="true" /> Excluir aqui também arquiva o artigo no projeto, com o rótulo como motivo.
      </p>
    </div>
  );
};

export type { ReviewTab };

/**
 * The systematic review of a project (#49), a page of its own: label sections, exclusions, the undecided
 * articles, the labels window and the way into the guided screening; the PRISMA diagram and the evaluation are
 * its other parts, listed in the project sidebar (board 164). An exclusion here archives the article in the project.
 *
 * Usage:
 *   <Route path="/projects/:id/review" element={<SystematicReviewPage />} />
 */
export const SystematicReviewPage: React.FC<{ tab?: ReviewTab }> = ({ tab = 'screening' }) => {
  const projectId = Number(useParams<{ id: string }>().id);
  const screening = useScreening(projectId);
  // The list shows one stage at a time (board 164); the sidebar, PRISMA and evaluation keep reading every decision.
  const [stage, setStage] = useSessionState<ScreeningStage>(`review.${projectId}.stage`, 'title');
  const { articles, labels, decisions } = screening;
  const stagedView = useMemo(
    () => buildReview(articles, labels, decisions, stage),
    [articles, labels, decisions, stage],
  );
  const staged: ScreeningState = { ...screening, view: stagedView };
  const [managing, setManaging] = useState(false);
  const [writingCriteria, setWritingCriteria] = useState(false);
  // Criteria written from the header change what the evaluation compares, so it reads them again.
  const [criteriaEdits, setCriteriaEdits] = useState(0);
  const [citing, setCiting] = useState<Article[] | null>(null);
  usePageCommands('review', [
    { id: 'review:criteria', label: 'Editar critérios do projeto', run: () => setWritingCriteria(true) },
    { id: 'review:labels', label: 'Gerenciar rótulos de triagem', run: () => setManaging(true) },
  ]);
  if (screening.loading) return <div className="review review-muted">Carregando a revisão…</div>;
  return (
    <div className="review fade-in">
      {/* The parts of the review live under its item in the project sidebar (board 164). */}
      <ProjectNavPortal>
        <ReviewNavList projectId={projectId} pending={screening.view.counts.pending} />
      </ProjectNavPortal>
      {tab !== 'prisma' && (
        <ReviewHeader
          projectId={projectId}
          tab={tab}
          counts={stagedView.counts}
          stage={stage}
          onManageLabels={() => setManaging(true)}
          onWriteCriteria={() => setWritingCriteria(true)}
        />
      )}
      {tab === 'prisma' && <PrismaTab projectId={projectId} screening={screening} />}
      {tab === 'evaluation' && (
        <div className="review-evaluation-columns">
          <EvaluationTab key={criteriaEdits} projectId={projectId} screening={screening} />
          <SimulationSection projectId={projectId} />
        </div>
      )}
      {tab === 'screening' && (
        <ReviewBody
          projectId={projectId}
          screening={staged}
          stage={stage}
          onStageChange={setStage}
          onCite={setCiting}
        />
      )}
      {screening.lastChange && <UndoToast change={screening.lastChange} />}
      <ManageLabelsModal
        isOpen={managing}
        onClose={() => setManaging(false)}
        projectId={projectId}
        screening={screening}
      />
      {writingCriteria && (
        <CriteriaModal
          projectId={projectId}
          onClose={() => {
            setWritingCriteria(false);
            setCriteriaEdits((n) => n + 1);
          }}
        />
      )}
      <MassCitationModal isOpen={citing !== null} onClose={() => setCiting(null)} articles={citing ?? []} />
    </div>
  );
};

export default SystematicReviewPage;
