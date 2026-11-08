import React from 'react';
import { Article } from '../../../types';
import { SourceDatabaseBadges } from '../../../components/common/SourceDatabaseBadges';
import { ArticleRowActions, type ArticleRowHandlers } from './articles/ArticleRowActions';
import type { OpenAccessRowState } from './articles/openAccessText';
import { ArticleSummary, AuthorList } from './articles/ArticleCells';
import './articles/articlesList.css';

interface ProjectArticlesListProps {
  paginatedArticles: Article[];
  setSelectedArticleForDetails: (article: Article) => void;
  handleUnlinkClick: (id: number) => void;
  handleUploadClick: (id: number) => void;
  handleStatusChange: (id: number, status: 'new' | 'read' | 'archived') => void;
  setEditingArticle: (article: Article) => void;
  setArchivingId: (id: number) => void;
  setCitationArticle: (article: Article) => void;
  onExploreCitations: (article: Article) => void;
  // Multi-select: when present, each row gets a checkbox.
  selection?: ArticleSelection;
  /** Each row's open access PDF search: its state and how to start it. */
  openAccess: { stateOf: (articleId: number) => OpenAccessRowState | undefined; onFind: (articleId: number) => void };
  /** History entries that only brought articles from outside the searches. */
  outsideSearchIds?: Set<number>;
}

export interface ArticleSelection {
  isSelected: (articleId: number) => boolean;
  onToggle: (articleId: number) => void;
}

export const ProjectArticlesList: React.FC<ProjectArticlesListProps> = ({
  paginatedArticles,
  setSelectedArticleForDetails,
  handleUnlinkClick,
  handleUploadClick,
  handleStatusChange,
  setEditingArticle,
  setArchivingId,
  setCitationArticle,
  onExploreCitations,
  selection,
  openAccess,
  outsideSearchIds,
}) => {
  const rowHandlers: ArticleRowHandlers = {
    onUpload: handleUploadClick,
    onFindOpenAccess: openAccess.onFind,
    onUnlink: handleUnlinkClick,
    onStatusChange: handleStatusChange,
    onEdit: setEditingArticle,
    onArchive: setArchivingId,
    onCite: setCitationArticle,
    onExploreCitations,
  };

  return (
    <div className="card articles-table-container">
      <table data-testid="main-articles-table" className="articles-table">
        <thead>
          <tr>
            {selection && <th className="articles-th-select" aria-label="Seleção" />}
            <th>ARTIGO</th>
            <th className="articles-col-authors">AUTORES</th>
            <th className="articles-col-bases">BASES</th>
            <th className="articles-th-actions">AÇÕES</th>
          </tr>
        </thead>
        <tbody>
          {paginatedArticles.map((article) => (
            <tr key={article.id} className={selection?.isSelected(article.id) ? 'is-selected' : undefined}>
              {selection && (
                <td className="articles-cell articles-cell--select">
                  <input
                    type="checkbox"
                    checked={selection.isSelected(article.id)}
                    onChange={() => selection.onToggle(article.id)}
                    aria-label={`Selecionar "${article.title}"`}
                  />
                </td>
              )}
              <td className="articles-cell">
                <ArticleSummary article={article} onOpenDetails={setSelectedArticleForDetails} />
              </td>
              <td className="articles-col-authors articles-cell articles-cell--authors">
                <AuthorList authors={article.authors} layout="column" />
              </td>
              <td className="articles-col-bases articles-cell">
                <div className="articles-bases">
                  <SourceDatabaseBadges
                    sourceDatabases={article.source_databases}
                    emptyPlaceholder={<span className="articles-bases-empty">-</span>}
                  />
                </div>
              </td>
              <td className="articles-cell--actions">
                <ArticleRowActions
                  article={article}
                  handlers={rowHandlers}
                  openAccess={openAccess.stateOf(article.id)}
                  outsideSearch={article.search_id !== undefined && !!outsideSearchIds?.has(article.search_id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {paginatedArticles.length === 0 && <div className="articles-empty">Nenhum artigo ativo na biblioteca.</div>}
    </div>
  );
};
