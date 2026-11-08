import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, CopyPlus } from 'lucide-react';
import type { Article } from '../../../../types';

import './articlesList.css';

interface ReadArticlesSectionProps {
  articles: Article[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onOpenMassCitation: () => void;
  onShowDetails: (article: Article) => void;
  onCite: (article: Article) => void;
  onMarkUnread: (articleId: number) => void;
}

/**
 * Collapsible list of read articles with shortcuts to open, inspect, cite or un-read them.
 *
 * Usage:
 *   <ReadArticlesSection articles={readArticles} isOpen={open} onToggle={setOpen} ... />
 */
export const ReadArticlesSection: React.FC<ReadArticlesSectionProps> = (props) => {
  const { articles, isOpen, onToggle, onOpenMassCitation, onShowDetails, onCite, onMarkUnread } = props;
  if (articles.length === 0) return null;
  const massCitationButton = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpenMassCitation();
      }}
      className="btn-primary mass-citation-button"
    >
      <CopyPlus size={12} /> Citação em Massa
    </button>
  );
  return (
    <ArticleAccordion
      label={`Artigos Lidos (${articles.length})`}
      tone="read"
      isOpen={isOpen}
      onToggle={onToggle}
      action={massCitationButton}
    >
      {articles.map((article) => (
        <tr key={article.id}>
          <td>{article.title}</td>
          <td className="article-accordion-actions--wide">
            <div className="article-accordion-buttons">
              <Link to={`/articles/${article.id}`} className="btn-secondary article-small-button">
                Ver
              </Link>
              <button onClick={() => onShowDetails(article)} className="btn-secondary article-small-button">
                Detalhes
              </button>
              <button onClick={() => onCite(article)} className="btn-secondary article-small-button">
                Citar
              </button>
              <button onClick={() => onMarkUnread(article.id)} className="btn-secondary article-small-button">
                Desmarcar
              </button>
            </div>
          </td>
        </tr>
      ))}
    </ArticleAccordion>
  );
};

interface ArchivedArticlesSectionProps {
  articles: Article[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onRestore: (articleId: number) => void;
}

/**
 * Collapsible list of archived articles with the reason they were discarded.
 *
 * Usage:
 *   <ArchivedArticlesSection articles={archived} isOpen={open} onToggle={setOpen} onRestore={restore} />
 */
export const ArchivedArticlesSection: React.FC<ArchivedArticlesSectionProps> = ({
  articles,
  isOpen,
  onToggle,
  onRestore,
}) => {
  if (articles.length === 0) return null;
  return (
    <ArticleAccordion
      label={`Artigos Arquivados (${articles.length})`}
      tone="archived"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {articles.map((article) => (
        <tr key={article.id}>
          <td>
            <div className="archived-title">{article.title}</div>
            <div className="archived-reason">Motivo: {article.archive_note}</div>
          </td>
          <td className="article-accordion-actions--narrow">
            <button onClick={() => onRestore(article.id)} className="btn-secondary article-small-button">
              Restaurar
            </button>
          </td>
        </tr>
      ))}
    </ArticleAccordion>
  );
};

interface ArticleAccordionProps {
  label: string;
  tone: 'read' | 'archived';
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const ArticleAccordion: React.FC<ArticleAccordionProps> = ({ label, tone, isOpen, onToggle, action, children }) => (
  <details
    className={`custom-accordion article-accordion article-accordion--${tone}`}
    open={isOpen}
    onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
  >
    <summary>
      <div className="article-accordion-label">
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>{label}</span>
      </div>
      {action}
    </summary>
    <div className="article-accordion-body">
      <table>
        <tbody>{children}</tbody>
      </table>
    </div>
  </details>
);
