import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, SearchHistoryItem } from '../../../types';
import type { ProjectFiltering } from '../hooks/useProjectFiltering';
import type { ProjectModals } from '../hooks/useProjectModals';
import { clearedFilters } from '../hooks/articleFilters';
import { ProjectArticlesList } from './ProjectArticlesList';
import { ArticlesToolbar } from './articles/ArticlesToolbar';
import { ArticlesFooter } from './articles/ArticlesFooter';
import { BatchBar } from './articles/BatchBar';
import { OpenAccessReport } from './articles/OpenAccessReport';
import { useArticleSelection, type ArticleSelectionState } from './articles/useArticleSelection';
import { useArticleKeyboard } from './articles/useArticleKeyboard';
import type { OpenAccessPdfs } from '../hooks/useOpenAccessPdfs';
import { ArticleInspector } from './inspector/ArticleInspector';
import { rowHandlersFor } from './ProjectArticlesList';

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
  /** For the details panel: where each article came from, and the way to that history. */
  history: SearchHistoryItem[];
  onShowHistory: () => void;
}

type WithSelection = ProjectArticlesTabProps & { selection: ArticleSelectionState };

const SelectionBar: React.FC<WithSelection> = ({ filtering, modals, selection, ...props }) => {
  // Every article the filters keep, on every page: selecting a page at a time was the slow part of a batch (validation
  // of epic #44).
  const listed = filtering.activeArticles;
  const allSelected = listed.length > 0 && listed.every((a) => selection.isSelected(a.id));
  const ids = selection.selected.map((a) => a.id);
  return (
    <BatchBar
      selectedCount={selection.selected.length}
      allSelected={allSelected}
      onToggleAll={() => selection.setMany(listed, !allSelected)}
      onMarkRead={() => props.onStatusChangeMany(ids, 'read')}
      onArchive={() => modals.setArchivingIds(ids)}
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
  );
};

const ArticlesTable: React.FC<WithSelection & { currentIndex: number }> = ({
  filtering,
  modals,
  selection,
  ...props
}) => (
  <ProjectArticlesList
    paginatedArticles={filtering.paginatedArticles}
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
    currentIndex={props.currentIndex}
  />
);

// J/K/Enter/X/Space: Enter reads the PDF when there is one, otherwise opens the details; X starts selecting if
// needed; Space shows or hides the details; while they show, J/K take them along to the new row.
function useListKeyboard(props: ProjectArticlesTabProps, selection: ArticleSelectionState): number {
  const navigate = useNavigate();
  const { modals } = props;
  const shown = modals.selectedArticleForDetails;
  const current = useArticleKeyboard(props.filtering.paginatedArticles, {
    onOpen: (a) => (a.local_file_path ? navigate(`/articles/${a.id}`) : modals.setSelectedArticleForDetails(a)),
    onToggleSelection: (a) => {
      selection.start();
      selection.toggle(a.id);
    },
    onToggleDetails: (a) => modals.setSelectedArticleForDetails(shown?.id === a.id ? null : a),
    onEscape: () => modals.setSelectedArticleForDetails(null),
  });
  const currentArticle = props.filtering.paginatedArticles[current];
  useEffect(() => {
    if (shown && currentArticle && shown.id !== currentArticle.id) modals.setSelectedArticleForDetails(currentArticle);
    // Only a move of the current row drags the panel along; opening another article by its title does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentArticle?.id]);
  return current;
}

const Inspector: React.FC<ProjectArticlesTabProps> = (props) => {
  const article = props.modals.selectedArticleForDetails;
  if (!article) return null;
  // The freshest copy from the list, so a change made from the panel shows at once.
  const listed = props.filtering.activeArticles.find((a) => a.id === article.id) ?? article;
  return (
    <ArticleInspector
      article={listed}
      handlers={rowHandlersFor(props)}
      history={props.history}
      onClose={() => props.modals.setSelectedArticleForDetails(null)}
      onShowHistory={() => {
        props.modals.setSelectedArticleForDetails(null);
        props.onShowHistory();
      }}
      outsideSearch={listed.search_id !== undefined && !!props.outsideSearchIds?.has(listed.search_id)}
    />
  );
};

/**
 * The Artigos section (board 153): search, order, status and filters above the table; the batch bar while
 * selecting; shortcuts, count and pages under it.
 *
 * Usage:
 *   <ProjectArticlesTab filtering={filtering} modals={modals} onStatusChange={change} ... />
 */
export const ProjectArticlesTab: React.FC<ProjectArticlesTabProps> = (props) => {
  const { filtering } = props;
  const selection = useArticleSelection(filtering.activeArticles);
  const currentIndex = useListKeyboard(props, selection);
  // "N de M": M is what the current status holds before any other filter or search.
  const total = filtering.countFor({ ...clearedFilters(filtering.criteria), searchTerm: '' });
  return (
    <div className="custom-controls project-articles">
      <ArticlesToolbar
        filtering={filtering}
        selecting={selection.selecting}
        onToggleSelecting={selection.selecting ? selection.exit : selection.start}
      />
      <div className="articles-workspace">
        <div className="project-articles-main articles-workspace__list">
          {selection.selecting && <SelectionBar {...props} selection={selection} />}
          <ArticlesTable {...props} selection={selection} currentIndex={currentIndex} />
          <ArticlesFooter
            shown={filtering.activeArticles.length}
            total={total}
            currentPage={filtering.currentPage}
            totalPages={filtering.totalPages}
            pageSize={filtering.itemsPerPage}
            onPageChange={filtering.setCurrentPage}
          />
          {props.openAccess.report && (
            <OpenAccessReport report={props.openAccess.report} onClose={props.openAccess.closeReport} />
          )}
        </div>
        <Inspector {...props} />
      </div>
    </div>
  );
};
