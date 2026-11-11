import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ListChecks, Play, Tag } from 'lucide-react';
import type { Article, ScreeningLabel } from '../../types';
import { listStage, type ReviewRow } from '../../utils/screeningView';
import { MassCitationModal } from '../../components/modals/MassCitationModal';
import { useScreening, type ScreeningState } from './useScreening';
import { ExcludedSection, LabelSection, type RowActions } from './ReviewSections';
import { PendingList } from './PendingList';
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

function rowActions(screening: ScreeningState): RowActions {
  return {
    labels: screening.labels,
    onPick: (row: ReviewRow, label: ScreeningLabel) =>
      void screening.decide(
        [row.article.id],
        label.id,
        listStage(row.article.id, screening.decisions),
        row.decision?.note,
      ),
    onUndo: (row: ReviewRow) => row.decision && void screening.undecide([row.article.id], row.decision.stage),
  };
}

interface ReviewHeaderProps {
  projectId: number;
  tab: ReviewTab;
  counts: ScreeningState['view']['counts'];
  onManageLabels: () => void;
  onWriteCriteria: () => void;
}

// What each part of the review says under its title (boards 164, 166, 167).
const decidedLine = (counts: ReviewHeaderProps['counts']) => {
  const decided = counts.include + counts.maybe + counts.exclude;
  return `${decided} de ${decided + counts.pending} decididos`;
};

const EVALUATION_NOTE =
  'Compara as sugestões da IA com as suas decisões. A IA nunca vê as suas decisões: só título, resumo e critérios.';

/** The page's header for each part (boards 164-167); the actions of the screening stay on every part. */
const ReviewHeader: React.FC<ReviewHeaderProps> = ({ projectId, tab, counts, onManageLabels, onWriteCriteria }) => {
  const titles: Record<ReviewTab, { eyebrow: string; title: string; subtitle?: string }> = {
    screening: { eyebrow: 'Revisão sistemática · PRISMA 2020', title: 'Triagem', subtitle: decidedLine(counts) },
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
      }
    />
  );
};

interface FilteredListProps {
  screening: ScreeningState;
  filter: ScreeningFilter;
  onCite: (articles: Article[]) => void;
}

/** The list of the chosen status: the undecided articles, or the label sections of that kind. */
const FilteredList: React.FC<FilteredListProps> = ({ screening, filter, onCite }) => {
  const sections = useOpenSections();
  const actions = rowActions(screening);
  const { view } = screening;
  if (filter === 'pending') {
    return (
      <PendingList
        rows={view.pending}
        labels={screening.labels}
        onPick={(rows, label) =>
          void screening.decide(
            rows.map((r) => r.article.id),
            label.id,
            'title',
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
const ReviewBody: React.FC<{ projectId: number; screening: ScreeningState; onCite: (articles: Article[]) => void }> = ({
  projectId,
  screening,
  onCite,
}) => {
  const { counts } = screening.view;
  const [stored, setFilter] = useSessionState<ScreeningFilter | null>(`review.${projectId}.filter`, null);
  const filter = stored ?? defaultFilter(counts);
  return (
    <div className="review-screening">
      <ScreeningStatusFilter counts={counts} value={filter} onChange={setFilter} />
      <FilteredList screening={screening} filter={filter} onCite={onCite} />
      {filterCount(counts, filter) === 0 && filter !== 'pending' && (
        <div className="review-empty">Nenhum artigo com este status.</div>
      )}
      <p className="review-footnote">Excluir aqui também arquiva o artigo no projeto, com o rótulo como motivo.</p>
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
      <ReviewHeader
        projectId={projectId}
        tab={tab}
        counts={screening.view.counts}
        onManageLabels={() => setManaging(true)}
        onWriteCriteria={() => setWritingCriteria(true)}
      />
      {tab === 'prisma' && <PrismaTab projectId={projectId} screening={screening} />}
      {tab === 'evaluation' && (
        <>
          <EvaluationTab key={criteriaEdits} projectId={projectId} screening={screening} />
          <SimulationSection projectId={projectId} />
        </>
      )}
      {tab === 'screening' && <ReviewBody projectId={projectId} screening={screening} onCite={setCiting} />}
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
