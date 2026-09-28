import React from 'react';
import { Article } from '../../../types';
import { SourceDatabaseBadges } from '../../../components/common/SourceDatabaseBadges';
import { ArticleRowActions, type ArticleRowHandlers } from './articles/ArticleRowActions';
import { ArticleSummary, AuthorList } from './articles/ArticleCells';

const cellStyle: React.CSSProperties = { padding: '1.25rem 1.5rem' };

const HeaderCell: React.FC<{ children: React.ReactNode; className?: string; align?: 'left' | 'right' }> = ({
  children,
  className,
  align = 'left',
}) => (
  <th
    className={className}
    style={{
      padding: '1rem 1.5rem',
      color: 'var(--text-muted)',
      fontWeight: 600,
      fontSize: '0.875rem',
      textAlign: align,
    }}
  >
    {children}
  </th>
);

interface ProjectArticlesListProps {
  paginatedArticles: Article[];
  setSelectedArticleForDetails: (article: Article) => void;
  handleUnlinkClick: (id: number) => void;
  handleUploadClick: (id: number) => void;
  handleStatusChange: (id: number, status: 'new' | 'read' | 'archived') => void;
  setEditingArticle: (article: Article) => void;
  setArchivingId: (id: number) => void;
  setCitationArticle: (article: Article) => void;
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
}) => {
  const rowHandlers: ArticleRowHandlers = {
    onUpload: handleUploadClick,
    onUnlink: handleUnlinkClick,
    onStatusChange: handleStatusChange,
    onEdit: setEditingArticle,
    onArchive: setArchivingId,
    onCite: setCitationArticle,
  };

  return (
    <div className="card articles-table-container" style={{ overflowX: 'auto', border: 'none', marginBottom: '2rem' }}>
      <table
        data-testid="main-articles-table"
        className="articles-table"
        style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}
      >
        <thead>
          <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
            <HeaderCell>ARTIGO</HeaderCell>
            <HeaderCell className="articles-col-authors">AUTORES</HeaderCell>
            <HeaderCell className="articles-col-bases">BASES</HeaderCell>
            <HeaderCell align="right">AÇÕES</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {paginatedArticles.map((article) => (
            <tr
              key={article.id}
              style={{
                borderBottom: '1px solid var(--border-color)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-main)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={cellStyle}>
                <ArticleSummary article={article} onOpenDetails={setSelectedArticleForDetails} />
              </td>
              <td className="articles-col-authors" style={{ ...cellStyle, maxWidth: '220px', fontSize: '0.9rem' }}>
                <AuthorList authors={article.authors} layout="column" />
              </td>
              <td className="articles-col-bases" style={cellStyle}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <SourceDatabaseBadges
                    sourceDatabases={article.source_databases}
                    emptyPlaceholder={<span style={{ color: 'var(--text-muted)' }}>-</span>}
                  />
                </div>
              </td>
              <td style={{ padding: '1rem 1.25rem', width: '1%' }}>
                <ArticleRowActions article={article} handlers={rowHandlers} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {paginatedArticles.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Nenhum artigo ativo na biblioteca.
        </div>
      )}
    </div>
  );
};
