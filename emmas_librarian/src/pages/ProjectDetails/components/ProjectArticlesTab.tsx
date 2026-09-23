import React from 'react';
import type { Article } from '../../../types';
import type { ProjectFiltering } from '../hooks/useProjectFiltering';
import type { ProjectModals } from '../hooks/useProjectModals';
import { ProjectArticlesList } from './ProjectArticlesList';
import { ProjectSidebar } from './ProjectSidebar';
import { ArticlesFilterBar } from './articles/ArticlesFilterBar';
import { ReadArticlesSection, ArchivedArticlesSection } from './articles/ArticleStatusSections';
import { PaginationSummary, PaginationControls } from './articles/ArticlesPagination';

type ArticleStatus = Article['status'];

interface ProjectArticlesTabProps {
  filtering: ProjectFiltering;
  modals: ProjectModals;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onStatusChange: (articleId: number, status: ArticleStatus) => void;
  onUnlinkPdf: (articleId: number) => void;
  onAttachPdf: (articleId: number) => void;
  isArticleManual: (article: Article) => boolean;
}

/**
 * The "Artigos" tab: filters, read/archived sections, and the paginated list of active articles.
 *
 * Usage:
 *   <ProjectArticlesTab filtering={filtering} modals={modals} isSidebarOpen={open} ... />
 */
export const ProjectArticlesTab: React.FC<ProjectArticlesTabProps> = (props) => {
  const { filtering, modals, isSidebarOpen, onToggleSidebar } = props;
  return (
    <>
      <ArticlesFilterBar filtering={filtering} isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggleSidebar} />
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', width: '100%' }}>
        {isSidebarOpen && <FiltersSidebar filtering={filtering} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <ReadArticlesSection
            articles={filtering.readArticles}
            isOpen={filtering.isReadArticlesOpen}
            onToggle={filtering.setIsReadArticlesOpen}
            onOpenMassCitation={() => modals.setIsMassCitationModalOpen(true)}
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
    </>
  );
};

const FiltersSidebar: React.FC<{ filtering: ProjectFiltering }> = ({ filtering }) => (
  <ProjectSidebar
    statusFilter={filtering.statusFilter}
    setStatusFilter={filtering.setStatusFilter}
    uniqueDatabases={filtering.uniqueDatabases}
    selectedDatabases={filtering.selectedDatabases}
    setSelectedDatabases={filtering.setSelectedDatabases}
    uniqueDocTypes={filtering.uniqueDocTypes}
    selectedDocType={filtering.selectedDocType}
    setSelectedDocType={filtering.setSelectedDocType}
    keywordFrequencies={filtering.keywordFrequencies}
    selectedKeyword={filtering.selectedKeyword}
    setSelectedKeyword={filtering.setSelectedKeyword}
    setCurrentPage={filtering.setCurrentPage}
  />
);

const PaginatedArticles: React.FC<ProjectArticlesTabProps> = ({ filtering, modals, onStatusChange, onUnlinkPdf, onAttachPdf, isArticleManual }) => {
  const { activeArticles, itemsPerPage, currentPage, totalPages, setCurrentPage } = filtering;
  const isPaginated = activeArticles.length > itemsPerPage;
  return (
    <>
      {isPaginated && (
        <PaginationSummary
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={itemsPerPage}
          totalItems={activeArticles.length}
          onPageChange={setCurrentPage}
        />
      )}
      <ProjectArticlesList
        paginatedArticles={filtering.paginatedArticles}
        setSelectedArticleForDetails={modals.setSelectedArticleForDetails}
        handleUnlinkClick={onUnlinkPdf}
        handleUploadClick={onAttachPdf}
        handleStatusChange={onStatusChange}
        setEditingArticle={modals.setEditingArticle}
        setArchivingId={modals.setArchivingId}
        setCitationArticle={modals.setCitationArticle}
        isArticleManual={isArticleManual}
      />
      {isPaginated && <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
    </>
  );
};
