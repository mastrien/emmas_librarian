import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, CopyPlus } from 'lucide-react';
import type { Article } from '../../../../types';

const smallButton: React.CSSProperties = { padding: '0.3rem 0.5rem', fontSize: '0.75rem' };
const cell: React.CSSProperties = { padding: '0.75rem 1rem' };

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
      className="btn-primary"
      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
    >
      <CopyPlus size={12} /> Citação em Massa
    </button>
  );
  return (
    <ArticleAccordion
      label={`Artigos Lidos (${articles.length})`}
      color="var(--color-primary)"
      isOpen={isOpen}
      onToggle={onToggle}
      action={massCitationButton}
    >
      {articles.map((article) => (
        <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
          <td style={cell}>{article.title}</td>
          <td style={{ ...cell, width: '320px' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link to={`/articles/${article.id}`} className="btn-secondary" style={smallButton}>
                Ver
              </Link>
              <button onClick={() => onShowDetails(article)} className="btn-secondary" style={smallButton}>
                Detalhes
              </button>
              <button onClick={() => onCite(article)} className="btn-secondary" style={smallButton}>
                Citar
              </button>
              <button onClick={() => onMarkUnread(article.id)} className="btn-secondary" style={smallButton}>
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
export const ArchivedArticlesSection: React.FC<ArchivedArticlesSectionProps> = ({ articles, isOpen, onToggle, onRestore }) => {
  if (articles.length === 0) return null;
  return (
    <ArticleAccordion label={`Artigos Arquivados (${articles.length})`} color="var(--color-danger)" isOpen={isOpen} onToggle={onToggle}>
      {articles.map((article) => (
        <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
          <td style={cell}>
            <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{article.title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Motivo: {article.archive_note}</div>
          </td>
          <td style={{ ...cell, width: '150px' }}>
            <button onClick={() => onRestore(article.id)} className="btn-secondary" style={smallButton}>
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
  color: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const ArticleAccordion: React.FC<ArticleAccordionProps> = ({ label, color, isOpen, onToggle, action, children }) => (
  <details
    className="custom-accordion"
    onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
    style={{
      marginBottom: '1rem',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      padding: '1rem',
    }}
  >
    <summary
      style={{
        fontWeight: 600,
        color,
        cursor: 'pointer',
        outline: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>{label}</span>
      </div>
      {action}
    </summary>
    <div style={{ marginTop: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
        <tbody>{children}</tbody>
      </table>
    </div>
  </details>
);
