import React, { useState } from 'react';
import { Calendar, GraduationCap, Unlock } from 'lucide-react';
import type { Article } from '../../../../types';
import { splitAuthorNames } from '../../../../utils/authors';
import { SourceDatabaseBadges } from '../../../../components/common/SourceDatabaseBadges';

const VISIBLE_AUTHORS = 3;
const META_ICON = 13;

const citationLabel = (count: number): string => `${count} ${count === 1 ? 'citação' : 'citações'}`;

/**
 * Year, DOI, citations and open access under the title. Open access lives here, not among the bases,
 * because it describes the article, not where it was found.
 *
 * @example <ArticleMetaLine article={article} />
 */
export const ArticleMetaLine: React.FC<{ article: Article }> = ({ article }) => (
  <div className="article-meta">
    <span className="article-meta__item">
      <Calendar size={META_ICON} /> {article.year || 'Ano não informado'}
    </span>
    {article.doi && <span className="article-meta__item article-meta__doi">DOI {article.doi}</span>}
    {article.citation_count != null && (
      <span className="article-meta__item">
        <GraduationCap size={META_ICON} /> {citationLabel(article.citation_count)}
      </span>
    )}
    {article.is_oa === 1 && (
      <span className="article-meta__item article-meta__oa">
        <Unlock size={META_ICON} /> Acesso aberto
      </span>
    )}
  </div>
);

interface AuthorListProps {
  authors?: string;
  // "column": wraps under the AUTORES header; "inline": one line inside the article cell.
  layout: 'column' | 'inline';
}

/**
 * The first three authors and a "+N" button that expands the whole list in place.
 *
 * @example <AuthorList authors={article.authors} layout="column" />
 */
export const AuthorList: React.FC<AuthorListProps> = ({ authors, layout }) => {
  const [expanded, setExpanded] = useState(false);
  const names = splitAuthorNames(authors);
  const className = `author-list author-list--${layout}${expanded ? ' is-expanded' : ''}`;
  if (names.length === 0) return <div className={className}>Autores desconhecidos</div>;

  const hidden = names.length - VISIBLE_AUTHORS;
  const shown = expanded || hidden <= 0 ? names : names.slice(0, VISIBLE_AUTHORS);
  return (
    <div className={className}>
      <span className="author-list__names">{shown.join('; ')}</span>
      {hidden > 0 && (
        <button
          type="button"
          className="author-list__more"
          aria-expanded={expanded}
          title={expanded ? undefined : names.join('; ')}
          aria-label={expanded ? 'Mostrar menos autores' : `Mostrar os ${names.length} autores`}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'mostrar menos' : `+${hidden}`}
        </button>
      )}
    </div>
  );
};

/**
 * The ARTIGO cell: title (clamped; the full text is in the tooltip and in the details), the metadata line,
 * and the authors and bases when the table is too narrow for their own columns.
 *
 * @example <ArticleSummary article={article} onOpenDetails={showDetails} />
 */
export const ArticleSummary: React.FC<{ article: Article; onOpenDetails: (article: Article) => void }> = ({
  article,
  onOpenDetails,
}) => (
  <>
    <div
      className="article-title"
      role="button"
      tabIndex={0}
      title={article.title}
      onClick={() => onOpenDetails(article)}
      onKeyDown={(e) => e.key === 'Enter' && onOpenDetails(article)}
    >
      {article.title}
    </div>
    <div className="articles-inline-authors">
      <AuthorList authors={article.authors} layout="inline" />
    </div>
    <ArticleMetaLine article={article} />
    <div className="articles-inline-bases">
      <SourceDatabaseBadges sourceDatabases={article.source_databases} />
    </div>
  </>
);
