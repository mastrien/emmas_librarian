import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  FileText,
  X as XIcon,
  Upload,
  CheckCircle,
  Edit2,
  Archive,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Article } from '../../types';
import { TableVirtuoso } from 'react-virtuoso';

interface ArticleTableProps {
  paginatedArticles: Article[];
  activeArticlesLength: number;
  uploadingId: number | null;
  onUnlinkClick: (id: number) => void;
  onUploadClick: (id: number) => void;
  onStatusChange: (id: number, status: 'read' | 'unread') => void;
  onEditClick: (article: Article) => void;
  onArchiveClick: (id: number) => void;
  isArticleManual: (article: Article) => boolean;
}

export const ArticleTable: React.FC<ArticleTableProps> = memo(
  ({
    paginatedArticles,
    activeArticlesLength,
    uploadingId,
    onUnlinkClick,
    onUploadClick,
    onStatusChange,
    onEditClick,
    onArchiveClick,
    isArticleManual,
  }) => {
    return (
      <div
        className="card"
        style={{ border: 'none', marginBottom: '2rem', height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {activeArticlesLength === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nenhum artigo ativo na biblioteca.
          </div>
        ) : (
          <TableVirtuoso
            style={{ flex: 1 }}
            data={paginatedArticles}
            components={{
              Table: (props) => (
                <table
                  {...props}
                  style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}
                />
              ),
              TableRow: (props) => (
                <tr
                  {...props}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-main)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                />
              ),
            }}
            fixedHeaderContent={() => (
              <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                <th
                  style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  TÍTULO
                </th>
                <th
                  style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  AUTORES
                </th>
                <th
                  style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  BASES
                </th>
                <th
                  style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  AÇÕES
                </th>
              </tr>
            )}
            itemContent={(index, article) => (
              <>
                <td style={{ padding: '1.25rem 1.5rem', maxWidth: '350px' }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-heading)',
                      marginBottom: '0.25rem',
                      lineHeight: '1.4',
                    }}
                  >
                    {article.title}
                  </div>
                  {article.doi && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>DOI: {article.doi}</div>
                  )}
                </td>
                <td
                  style={{
                    padding: '1.25rem 1.5rem',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    maxWidth: '250px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <Calendar size={14} color="var(--text-muted)" /> {article.year || 'N/A'}
                  </div>
                  {article.authors}
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {(() => {
                      try {
                        return JSON.parse(article.source_databases || '[]').map((base: string) => {
                          const isManual = base === 'Manual';
                          return (
                            <span
                              key={base}
                              style={{
                                padding: '0.2rem 0.6rem',
                                background: isManual ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)',
                                border: isManual ? '1px solid var(--color-danger)' : '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-xl)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: isManual ? 'var(--color-danger)' : 'var(--color-primary)',
                              }}
                              title={isManual ? 'Metadados adicionados manualmente (podem conter erros)' : undefined}
                            >
                              {isManual ? '⚠️ Manual' : base}
                            </span>
                          );
                        });
                      } catch (e) {
                        return null;
                      }
                    })()}
                    {article.is_oa === 1 && (
                      <span
                        style={{
                          padding: '0.2rem 0.6rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid var(--color-success, #10b981)',
                          borderRadius: 'var(--radius-xl)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-success, #10b981)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        🔓 Acesso Aberto
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link
                      to={`/articles/${article.id}`}
                      className="btn-primary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                    >
                      <FileText size={14} /> Ler
                    </Link>

                    {article.local_file_path ? (
                      <button
                        onClick={() => onUnlinkClick(article.id)}
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                        title="Desvincular PDF"
                      >
                        <XIcon size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onUploadClick(article.id)}
                        disabled={uploadingId === article.id}
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                        title="Vincular PDF Local"
                      >
                        {uploadingId === article.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Upload size={14} />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => onStatusChange(article.id, 'read')}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      title="Marcar como Lido"
                    >
                      <CheckCircle size={14} /> Lido
                    </button>

                    {isArticleManual(article) && (
                      <button
                        onClick={() => onEditClick(article)}
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                        title="Editar Metadados"
                      >
                        <Edit2 size={14} /> Editar
                      </button>
                    )}

                    <button
                      onClick={() => onArchiveClick(article.id)}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                      title="Arquivar"
                    >
                      <Archive size={14} /> Arquivar
                    </button>

                    {article.doi && (
                      <a
                        href={`https://doi.org/${article.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none' }}
                        title="Abrir no Navegador"
                      >
                        <ExternalLink size={14} /> Buscar por DOI
                      </a>
                    )}
                  </div>
                </td>
              </>
            )}
          />
        )}
      </div>
    );
  },
);
