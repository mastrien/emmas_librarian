import React, { useState } from 'react';
import type { Article } from '../../../types';
import type { ProjectFiltering } from '../hooks/useProjectFiltering';
import type { ProjectModals } from '../hooks/useProjectModals';
import { activeFilters, clearedFilters, withoutFilter } from '../hooks/articleFilters';
import { ProjectArticlesList } from './ProjectArticlesList';
import { ArticlesFilterBar } from './articles/ArticlesFilterBar';
import { FiltersPanel } from './articles/FiltersPanel';
import { ResultLine } from './articles/ResultLine';
import { BatchBar } from './articles/BatchBar';
import { ReadArticlesSection, ArchivedArticlesSection } from './articles/ArticleStatusSections';
import { PaginationControls } from './articles/ArticlesPagination';
import { OpenAccessReport } from './articles/OpenAccessReport';
import type { OpenAccessPdfs } from '../hooks/useOpenAccessPdfs';

type ArticleStatus = Article['status'];

interface ProjectArticlesTabProps {
  filtering: ProjectFiltering;
  modals: ProjectModals;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onStatusChange: (articleId: number, status: ArticleStatus) => void;
  onStatusChangeMany: (articleIds: number[], status: ArticleStatus) => void;
  onUnlinkPdf: (articleId: number) => void;
  onAttachPdf: (articleId: number) => void;
  openAccess: OpenAccessPdfs;
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
 * The "Artigos" tab: filter bar, filter panel, read/archived sections, the result line (or the batch
 * actions bar while multi-select is on) and the paginated list of articles.
 *
 * Usage:
 *   <ProjectArticlesTab filtering={filtering} modals={modals} isSidebarOpen={open} ... />
 */
export const ProjectArticlesTab: React.FC<ProjectArticlesTabProps> = (props) => {
  const { filtering, modals, isSidebarOpen, onToggleSidebar } = props;
  return (
    <div className="custom-controls">
      <ArticlesFilterBar filtering={filtering} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', width: '100%' }}>
        {isSidebarOpen && <FiltersPanel filtering={filtering} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <ReadArticlesSection
            articles={filtering.readArticles}
            isOpen={filtering.isReadArticlesOpen}
            onToggle={filtering.setIsReadArticlesOpen}
            onOpenMassCitation={() => {
              modals.setMassCitationArticles(null);
              modals.setIsMassCitationModalOpen(true);
            }}
            onShowDetails={modals.setSelectedArticleForDetails}
            onCite={modals.setCitationArticle}
            onMarkUnread={(id) => props.onStatusChange(id, 'new')}
          />
          <ArchivedArticlesSection
            articles={filtering.archivedArticles}
            isOpen={filtering.isArchivedArticlesOpen}
            onToggle={filtering.setIsArchivedArticlesOpen}
            onRestore={(id) => props.onStatusChange(id, 'new')}
          />
          <PaginatedArticles {...props} />
        </div>
      </div>
    </div>
  );
};

const PaginatedArticles: React.FC<ProjectArticlesTabProps> = (props) => {
  const { filtering, modals, isSidebarOpen, onToggleSidebar } = props;
  const { activeArticles, paginatedArticles, criteria, applyCriteria, currentPage, totalPages, setCurrentPage } =
    filtering;
  const selection = useArticleSelection(activeArticles);
  const allOnPageSelected = paginatedArticles.length > 0 && paginatedArticles.every((a) => selection.isSelected(a.id));
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
          allOnPageSelected={allOnPageSelected}
          onToggleAll={() => selection.setMany(paginatedArticles, !allOnPageSelected)}
          onMarkRead={() => props.onStatusChangeMany(selectedIds, 'read')}
          onArchive={() => modals.setArchivingIds(selectedIds)}
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
          filters={activeFilters(criteria)}
          onRemove={(key) => applyCriteria(withoutFilter(criteria, key))}
          onClear={() => applyCriteria(clearedFilters(criteria))}
          onShowAll={() => !isSidebarOpen && onToggleSidebar()}
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
        selection={selection.selecting ? { isSelected: selection.isSelected, onToggle: selection.toggle } : undefined}
        openAccess={{ stateOf: (id) => props.openAccess.rows[id], onFind: props.openAccess.fetchOne }}
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
