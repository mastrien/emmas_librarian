import React from 'react';
import { Article } from '../../../types';
import { SourceDatabaseBadges } from '../../../components/common/SourceDatabaseBadges';
import { ArticleRowActions, type ArticleRowHandlers } from './articles/ArticleRowActions';
import type { OpenAccessRowState } from './articles/openAccessText';
import { ArticleSummary } from './articles/ArticleCells';
import { PdfCell } from './articles/PdfCell';
import './articles/articlesList.css';
import './articles/articlesTable.css';

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
  /** The row J/K moved to (-1: none). */
  currentIndex?: number;
}

export interface ArticleSelection {
  isSelected: (articleId: number) => boolean;
  onToggle: (articleId: number) => void;
}

interface ArticleRowProps {
  article: Article;
  handlers: ArticleRowHandlers;
  props: ProjectArticlesListProps;
  isCurrent: boolean;
}

const SelectCell: React.FC<{ article: Article; selection: ArticleSelection }> = ({ article, selection }) => (
  <td className="articles-cell articles-cell--select">
    <input
      type="checkbox"
      checked={selection.isSelected(article.id)}
      onChange={() => selection.onToggle(article.id)}
      aria-label={`Selecionar "${article.title}"`}
    />
  </td>
);

const rowClass = (selected: boolean, current: boolean): string | undefined =>
  [selected && 'is-selected', current && 'is-current'].filter(Boolean).join(' ') || undefined;

const ArticleRow: React.FC<ArticleRowProps> = ({ article, handlers, props, isCurrent }) => {
  const { selection, openAccess, outsideSearchIds } = props;
  const oa = openAccess.stateOf(article.id);
  return (
    <tr
      className={rowClass(Boolean(selection?.isSelected(article.id)), isCurrent)}
      aria-current={isCurrent || undefined}
    >
      {selection && <SelectCell article={article} selection={selection} />}
      <td className="articles-cell">
        <ArticleSummary article={article} onOpenDetails={props.setSelectedArticleForDetails} openAccess={oa} />
      </td>
      <td className="articles-cell articles-cell--year">{article.year || '—'}</td>
      <td className="articles-cell articles-col-bases">
        <div className="articles-bases">
          <SourceDatabaseBadges sourceDatabases={article.source_databases} compact emptyPlaceholder="—" />
        </div>
      </td>
      <td className="articles-cell articles-cell--pdf">
        <PdfCell article={article} handlers={handlers} searching={oa?.status === 'running'} />
      </td>
      <td className="articles-cell articles-cell--menu">
        <ArticleRowActions
          article={article}
          handlers={handlers}
          outsideSearch={article.search_id !== undefined && !!outsideSearchIds?.has(article.search_id)}
        />
      </td>
    </tr>
  );
};

/**
 * The project's article table (board 153): a checkbox only while selecting, the article (title, byline), year,
 * bases, PDF and a "⋯" with every other action. The row J/K moved to is marked.
 *
 * @example <ProjectArticlesList paginatedArticles={page} openAccess={oa} currentIndex={0} … />
 */
export const ProjectArticlesList: React.FC<ProjectArticlesListProps> = (props) => {
  const handlers: ArticleRowHandlers = {
    onUpload: props.handleUploadClick,
    onFindOpenAccess: props.openAccess.onFind,
    onUnlink: props.handleUnlinkClick,
    onStatusChange: props.handleStatusChange,
    onEdit: props.setEditingArticle,
    onArchive: props.setArchivingId,
    onCite: props.setCitationArticle,
    onExploreCitations: props.onExploreCitations,
  };
  return (
    <div className="card articles-table-container">
      <table data-testid="main-articles-table" className="articles-table">
        <thead>
          <tr>
            {props.selection && <th className="articles-th-select" aria-label="Seleção" />}
            <th>Artigo</th>
            <th className="articles-th-year">Ano</th>
            <th className="articles-col-bases">Bases</th>
            <th className="articles-th-pdf">PDF</th>
            <th className="articles-th-menu" aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {props.paginatedArticles.map((article, index) => (
            <ArticleRow
              key={article.id}
              article={article}
              handlers={handlers}
              props={props}
              isCurrent={index === props.currentIndex}
            />
          ))}
        </tbody>
      </table>
      {props.paginatedArticles.length === 0 && <div className="articles-empty">Nenhum artigo nesta lista.</div>}
    </div>
  );
};
