import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Article } from '../../../src/types';
import { Await, Empty } from '../components';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';

const STATUS_LABELS: Record<string, string> = { new: 'Novo', read: 'Lido', archived: 'Arquivado' };

/**
 * The articles whose title or authors contain the text, ignoring case and accents.
 *
 * @example matchingArticles(articles, 'revisao') // also finds "Revisão sistemática"
 */
export function matchingArticles(articles: Article[], text: string): Article[] {
  const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const wanted = plain(text.trim());
  if (!wanted) return articles;
  return articles.filter((article) => plain(`${article.title} ${article.authors ?? ''}`).includes(wanted));
}

const ArticleRow: React.FC<{ article: Article }> = ({ article }) => (
  <li>
    <Link to={`/articles/${article.id}`} className="m-row">
      <span className="m-row__title">{article.title}</span>
      <span className="m-row__detail">
        {[article.authors, article.year].filter(Boolean).join(' · ')}
        <span className={`m-badge m-badge--${article.status}`}>{STATUS_LABELS[article.status] ?? article.status}</span>
        {article.local_file_path && <span className="m-badge">PDF</span>}
      </span>
    </Link>
  </li>
);

/**
 * The articles of a project, with a filter by title or author.
 *
 * @example <ArticlesTab projectId={3} />
 */
export const ArticlesTab: React.FC<{ projectId: number }> = ({ projectId }) => {
  const reader = useReader();
  const [filter, setFilter] = useState('');
  const articles = useLoaded(useCallback(() => reader.listArticles(projectId), [reader, projectId]));
  return (
    <Await loaded={articles}>
      {(all) => {
        const shown = matchingArticles(all, filter);
        return (
          <>
            <input
              className="m-input"
              type="search"
              placeholder="Filtrar por título ou autor"
              aria-label="Filtrar artigos"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            {shown.length === 0 ? (
              <Empty>{all.length === 0 ? 'Nenhum artigo neste projeto.' : 'Nenhum artigo com esse texto.'}</Empty>
            ) : (
              <ul className="m-list">
                {shown.map((article) => (
                  <ArticleRow key={article.id} article={article} />
                ))}
              </ul>
            )}
          </>
        );
      }}
    </Await>
  );
};
