import React from 'react';
import type { Article } from '../../../../types';
import { shortAuthorList } from '../../../../utils/authors';
import { openAccessMessage, type OpenAccessRowState } from './openAccessText';

/**
 * "Hersbach H.; Bell B.; Berrisford P.; +38 · Quarterly Journal…": the first authors and the venue on one line
 * under the title (board 153), where the old table had an AUTORES column.
 *
 * @example articleByline({ authors: 'Silva, A.; Costa, B.', journal: 'Nature' } as Article) // 'Silva, A.; Costa, B. · Nature'
 */
export function articleByline(article: Pick<Article, 'authors' | 'journal'>): string {
  const authors = shortAuthorList(article.authors);
  return article.journal ? `${authors} · ${article.journal}` : authors;
}

const OpenAccessNote: React.FC<{ state?: OpenAccessRowState }> = ({ state }) => {
  if (!state || state.status === 'running') return null;
  const message = openAccessMessage(state);
  return (
    <div className={`article-note article-note--${message.tone}`} role="status">
      {message.text}
      {message.page && (
        <a href={message.page} target="_blank" rel="noreferrer">
          Abrir a página
        </a>
      )}
    </div>
  );
};

interface ArticleSummaryProps {
  article: Article;
  onOpenDetails: (article: Article) => void;
  openAccess?: OpenAccessRowState;
}

/**
 * The ARTIGO cell: the title (opens the details), the byline, why it was archived, and the result of an open
 * access PDF search when there is one.
 *
 * @example <ArticleSummary article={article} onOpenDetails={showDetails} />
 */
export const ArticleSummary: React.FC<ArticleSummaryProps> = ({ article, onOpenDetails, openAccess }) => {
  const byline = articleByline(article);
  return (
    <div className="article-summary">
      <button type="button" className="article-title" title={article.title} onClick={() => onOpenDetails(article)}>
        {article.title}
      </button>
      <div className="article-byline" title={byline}>
        {byline}
      </div>
      {/* The archived articles used to show their reason in a section of their own; they now share the table. */}
      {article.status === 'archived' && article.archive_note && (
        <div className="article-note">Motivo: {article.archive_note}</div>
      )}
      <OpenAccessNote state={openAccess} />
    </div>
  );
};
