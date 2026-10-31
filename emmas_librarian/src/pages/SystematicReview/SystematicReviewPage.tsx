import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Tag } from 'lucide-react';
import type { Article, ScreeningLabel } from '../../types';
import { listStage, type ReviewRow } from '../../utils/screeningView';
import { MassCitationModal } from '../../components/modals/MassCitationModal';
import { useScreening, type ScreeningState } from './useScreening';
import { ExcludedSection, LabelSection, type RowActions } from './ReviewSections';
import { PendingList } from './PendingList';
import { ReviewCountsBar, UndoToast } from './ReviewBits';
import { ManageLabelsModal } from './ManageLabelsModal';
import './review.css';

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

const ReviewHeader: React.FC<{ projectId: number; projectName: string; onManageLabels: () => void }> = ({
  projectId,
  projectName,
  onManageLabels,
}) => (
  <div className="review-header">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
      <Link to={`/projects/${projectId}`} className="review-back">
        <ArrowLeft size={18} aria-hidden="true" /> Voltar ao projeto
      </Link>
      <span className="review-muted">{projectName}</span>
      <h1 className="review-title">Revisão sistemática</h1>
    </div>
    <div className="review-actions">
      <button type="button" className="review-quiet" onClick={onManageLabels}>
        <Tag size={16} aria-hidden="true" /> Gerenciar rótulos
      </button>
      <Link to={`/projects/${projectId}/review/guided`} className="btn-primary">
        <Play size={16} aria-hidden="true" /> Iniciar triagem guiada
      </Link>
    </div>
  </div>
);

const ReviewBody: React.FC<{ screening: ScreeningState; onCite: (articles: Article[]) => void }> = ({
  screening,
  onCite,
}) => {
  const sections = useOpenSections();
  const actions = rowActions(screening);
  const { view } = screening;
  return (
    <>
      <ReviewCountsBar counts={view.counts} />
      {view.sections.map((group) => (
        <LabelSection
          key={group.label.id}
          group={group}
          open={sections.isOpen(`label-${group.label.id}`)}
          onToggle={() => sections.toggle(`label-${group.label.id}`)}
          actions={actions}
          onCite={group.label.kind === 'include' ? () => onCite(group.rows.map((r) => r.article)) : undefined}
        />
      ))}
      <ExcludedSection
        groups={view.excluded}
        unlabeled={view.unlabeled}
        open={sections.isOpen('excluded')}
        onToggle={() => sections.toggle('excluded')}
        actions={actions}
      />
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
    </>
  );
};

/**
 * The systematic review of a project (#49), a page of its own like the PDF reader: label sections, exclusions,
 * the undecided articles, the labels window and the way into the guided screening. The project page does not
 * change; an exclusion here archives the article there.
 *
 * Usage:
 *   <Route path="/projects/:id/review" element={<SystematicReviewPage />} />
 */
export const SystematicReviewPage: React.FC = () => {
  const projectId = Number(useParams<{ id: string }>().id);
  const screening = useScreening(projectId);
  const [managing, setManaging] = useState(false);
  const [citing, setCiting] = useState<Article[] | null>(null);
  if (screening.loading) return <div className="review review-muted">Carregando a revisão…</div>;
  return (
    <div className="review fade-in">
      <ReviewHeader
        projectId={projectId}
        projectName={screening.project?.name ?? ''}
        onManageLabels={() => setManaging(true)}
      />
      <ReviewBody screening={screening} onCite={setCiting} />
      {screening.lastChange && <UndoToast change={screening.lastChange} />}
      <ManageLabelsModal
        isOpen={managing}
        onClose={() => setManaging(false)}
        projectId={projectId}
        screening={screening}
      />
      <MassCitationModal isOpen={citing !== null} onClose={() => setCiting(null)} articles={citing ?? []} />
    </div>
  );
};

export default SystematicReviewPage;
