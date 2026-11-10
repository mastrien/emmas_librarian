import React, { useState } from 'react';
import type { Article } from '../../../types';
import type { ProjectFiltering } from '../hooks/useProjectFiltering';
import type { ProjectModals } from '../hooks/useProjectModals';
import { clearedFilters } from '../hooks/articleFilters';
import { ProjectArticlesList } from './ProjectArticlesList';
import { ArticlesToolbar } from './articles/ArticlesToolbar';
import { ResultLine } from './articles/ResultLine';
import { BatchBar } from './articles/BatchBar';
import { PaginationControls } from './articles/ArticlesPagination';
import { OpenAccessReport } from './articles/OpenAccessReport';
import type { OpenAccessPdfs } from '../hooks/useOpenAccessPdfs';

type ArticleStatus = Article['status'];

interface ProjectArticlesTabProps {
  filtering: ProjectFiltering;
  modals: ProjectModals;
  onStatusChange: (articleId: number, status: ArticleStatus) => void;
  onStatusChangeMany: (articleIds: number[], status: ArticleStatus) => void;
  onUnlinkPdf: (articleId: number) => void;
  onAttachPdf: (articleId: number) => void;
  openAccess: OpenAccessPdfs;
  /** History entries that only brought articles from outside the searches. */
  outsideSearchIds?: Set<number>;
}

/**
 * Multi-select state. Only articles still in the filtered list count as selected, so an article that
 * was archived or filtered out leaves the selection by itself.
 */
function useArticleSelection(listed: Article[]) {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<Set<number>>(new Set());
  const selected = listed.filter((a) => ids.has(a.id));
  const toggle = (id: number) =>
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (articles: Article[], on: boolean) =>
    setIds((prev) => {
      const next = new Set(prev);
      articles.forEach((a) => (on ? next.add(a.id) : next.delete(a.id)));
      return next;
    });
  const start = () => setSelecting(true);
  const exit = () => {
    setSelecting(false);
    setIds(new Set());
  };
  return { selecting, selected, isSelected: (id: number) => ids.has(id), toggle, setMany, start, exit };
}

/**
 * The Artigos section (board 153): search, order, status and filters above the paginated list; the batch actions
 * bar replaces the result line while multi-select is on.
 *
 * Usage:
 *   <ProjectArticlesTab filtering={filtering} modals={modals} onStatusChange={change} ... />
 */
export const ProjectArticlesTab: React.FC<ProjectArticlesTabProps> = (props) => (
  <div className="custom-controls project-articles">
    <ArticlesToolbar filtering={props.filtering} />
    <div className="project-articles-main">
      <PaginatedArticles {...props} />
    </div>
  </div>
);

const PaginatedArticles: React.FC<ProjectArticlesTabProps> = (props) => {
  const { filtering, modals } = props;
  const { activeArticles, paginatedArticles, criteria, currentPage, totalPages, setCurrentPage } = filtering;
  const selection = useArticleSelection(activeArticles);
  // Every article the filters keep, on every page: selecting a page at a time was the slow part of a batch (validation
  // of epic #44).
  const allSelected = activeArticles.length > 0 && activeArticles.every((a) => selection.isSelected(a.id));
  const selectedIds = selection.selected.map((a) => a.id);
  // "N de M": M is what the current status filter holds before any other filter or search.
  const total = filtering.countFor({
    ...clearedFilters(criteria),
    searchTerm: '',
    statusFilter: criteria.statusFilter,
  });

  return (
    <>
      {selection.selecting ? (
        <BatchBar
          selectedCount={selection.selected.length}
          allSelected={allSelected}
          onToggleAll={() => selection.setMany(activeArticles, !allSelected)}
          onMarkRead={() => props.onStatusChangeMany(selectedIds, 'read')}
          onArchive={() => modals.setArchivingIds(selectedIds)}
          onExploreCitations={() => modals.setCitationSeedArticles(selection.selected)}
          onCite={() => {
            modals.setMassCitationArticles(selection.selected);
            modals.setIsMassCitationModalOpen(true);
          }}
          onExit={selection.exit}
          onFetchOpenAccess={() => props.openAccess.runBatch(selection.selected)}
          onCancelOpenAccess={props.openAccess.cancel}
          openAccessProgress={props.openAccess.progress}
        />
      ) : (
        <ResultLine
          shown={activeArticles.length}
          total={total}
          onStartSelection={selection.start}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
      <ProjectArticlesList
        paginatedArticles={paginatedArticles}
        setSelectedArticleForDetails={modals.setSelectedArticleForDetails}
        handleUnlinkClick={props.onUnlinkPdf}
        handleUploadClick={props.onAttachPdf}
        handleStatusChange={props.onStatusChange}
        setEditingArticle={modals.setEditingArticle}
        setArchivingId={modals.setArchivingId}
        setCitationArticle={modals.setCitationArticle}
        onExploreCitations={(article) => modals.setCitationSeedArticles([article])}
        selection={selection.selecting ? { isSelected: selection.isSelected, onToggle: selection.toggle } : undefined}
        openAccess={{ stateOf: (id) => props.openAccess.rows[id], onFind: props.openAccess.fetchOne }}
        outsideSearchIds={props.outsideSearchIds}
      />
      {props.openAccess.report && (
        <OpenAccessReport report={props.openAccess.report} onClose={props.openAccess.closeReport} />
      )}
      {totalPages > 1 && (
        <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </>
  );
};
