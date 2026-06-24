// @ts-nocheck
import React from 'react';
import { Article, ProjectCategory } from '../../../types';
import { FileText, Link2, Download, Archive, Edit, MessageSquare } from 'lucide-react';
import { getArticleStatusColor, getArticleStatusLabel, formatDate } from '../../../utils/formatters';

interface ArticleTableProps {
  articles: Article[];
  projectCategories: ProjectCategory[];
  articleCategories: Record<number, number[]>;
  onUploadClick: (article: Article) => void;
  onUnlinkClick: (article: Article) => void;
  onStatusChange: (article: Article, status: 'new' | 'read' | 'archived') => void;
  onEditClick: (article: Article) => void;
  setCitationArticle: (article: Article) => void;
  setSelectedArticleForDetails: (article: Article) => void;
  testId?: string;
}

export const ArticleTable: React.FC<ArticleTableProps> = ({
  articles,
  projectCategories,
  articleCategories,
  onUploadClick,
  onUnlinkClick,
  onStatusChange,
  onEditClick,
  setCitationArticle,
  setSelectedArticleForDetails,
  testId = "main-articles-table"
}) => {
  return (
    <div style={{ overflowX: 'auto', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
      <table data-testid={testId} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
            <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>TTULO</th>
            <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>AUTORES</th>
            <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>BASES</th>
            <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>A��ES</th>
          </tr>
        </thead>
        <tbody>
          {articles.map(article => (
            <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-main)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '1.25rem 1.5rem', maxWidth: '350px' }}>
                <div 
                  onClick={() => setSelectedArticleForDetails(article)}
                  style={{ 
                    fontWeight: 600, 
                    color: 'var(--color-primary)', 
                    cursor: 'pointer', 
                    marginBottom: '0.25rem', 
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    transition: 'color var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                >
                  {article.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.15rem 0.6rem', 
                    borderRadius: '2rem', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    backgroundColor: getArticleStatusColor(article.status) + '20',
                    color: getArticleStatusColor(article.status),
                    border: '1px solid ' + getArticleStatusColor(article.status) + '40'
                  }}>
                    {getArticleStatusLabel(article.status)}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{article.year || 'S/D'}</span>
                  
                  {articleCategories[article.id] && articleCategories[article.id].length > 0 && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginLeft: '0.5rem' }}>
                      {articleCategories[article.id].map(catId => {
                        const cat = projectCategories.find(c => c.id === catId);
                        if (!cat) return null;
                        return (
                          <span 
                            key={catId}
                            style={{ 
                              display: 'inline-block',
                              padding: '0.1rem 0.4rem', 
                              borderRadius: 'var(--radius-sm)', 
                              fontSize: '0.7rem',
                              backgroundColor: (("#6c757d") || '#6c757d') + '20',
                              color: ("#6c757d") || '#6c757d',
                              border: '1px solid ' + (("#6c757d") || '#6c757d') + '40'
                            }}
                            title={cat.name}
                          >
                            {cat.name.length > 15 ? cat.name.substring(0, 15) + '...' : cat.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </td>
              <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <div style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {article.authors || 'Autores desconhecidos'}
                </div>
              </td>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {(() => {
                    const bases = new Set<string>();
                    if ((!article.search_id)) bases.add('MANUAL');
                    else if (article.source_databases) bases.add(article.source_databases.toUpperCase());
                    
                    if (bases.size === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>;
                    
                    return Array.from(bases).map(base => (
                      <span key={base} style={{ 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.7rem', 
                        fontWeight: 600,
                        backgroundColor: base === 'MANUAL' ? '#10b98120' : 'var(--bg-main)',
                        color: base === 'MANUAL' ? '#10b981' : 'var(--text-muted)',
                        border: '1px solid',
                        borderColor: base === 'MANUAL' ? '#10b98140' : 'var(--border-color)'
                      }}>
                        {base}
                      </span>
                    ));
                  })()}
                </div>
              </td>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(!!article.local_file_path) ? (
                    <button 
                      onClick={() => window.location.hash = "/articles/" + article.id}
                      style={{ 
                        padding: '0.4rem 0.75rem', 
                        backgroundColor: '#10b98115', 
                        color: '#10b981', 
                        border: '1px solid #10b98130',
                        borderRadius: 'var(--radius-md)', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        transition: 'all var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#10b98125'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b98115'}
                      title="Ler PDF"
                    >
                      <FileText size={16} />
                      <span>Ler PDF</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button 
                        onClick={() => onUploadClick(article)}
                        style={{ 
                          padding: '0.4rem 0.75rem', 
                          backgroundColor: 'var(--bg-main)', 
                          color: 'var(--color-primary)', 
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        title="Fazer upload do PDF"
                      >
                        <FileText size={16} />
                        <span>PDF</span>
                      </button>
                      <button 
                        onClick={() => onUnlinkClick(article)}
                        style={{ 
                          padding: '0.4rem', 
                          backgroundColor: 'var(--bg-main)', 
                          color: 'var(--text-muted)', 
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Vincular a arquivo local existente"
                      >
                        <Link2 size={16} />
                      </button>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '0.25rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.5rem', marginLeft: '0.25rem' }}>
                    <button 
                      onClick={() => setCitationArticle(article)}
                      style={{ padding: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-main)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      title="Cita��o e Metadados"
                    >
                      <MessageSquare size={16} />
                    </button>
                    
                    {(!article.search_id) && (
                      <button 
                        onClick={() => onEditClick(article)}
                        style={{ padding: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-main)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    
                    {article.status !== 'archived' ? (
                      <button 
                        onClick={() => onStatusChange(article, 'archived')}
                        style={{ padding: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = 'var(--color-danger)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Arquivar"
                      >
                        <Archive size={16} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => onStatusChange(article, 'new')}
                        style={{ padding: '0.4rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#10b981'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Restaurar"
                      >
                        <Archive size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
