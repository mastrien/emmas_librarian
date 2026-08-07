import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, FileText, Upload, Loader2, Edit2, Archive, CopyPlus, ExternalLink, X as XIcon, CheckCircle, History } from 'lucide-react';
import { Article } from '../../../types';

interface ProjectArticlesListProps {
  paginatedArticles: Article[];
  setSelectedArticleForDetails: (article: Article) => void;
  handleUnlinkClick: (id: number) => void;
  handleUploadClick: (id: number) => void;
  uploadingId: number | null;
  handleStatusChange: (id: number, status: 'new' | 'read' | 'archived') => void;
  setEditingArticle: (article: Article) => void;
  setArchivingId: (id: number) => void;
  setCitationArticle: (article: Article) => void;
  isArticleManual: (article: Article) => boolean;
}

export const ProjectArticlesList: React.FC<ProjectArticlesListProps> = ({
  paginatedArticles,
  setSelectedArticleForDetails,
  handleUnlinkClick,
  handleUploadClick,
  uploadingId,
  handleStatusChange,
  setEditingArticle,
  setArchivingId,
  setCitationArticle,
  isArticleManual
}) => {
  return (
    <div className="card" style={{ overflowX: 'auto', border: 'none', marginBottom: '2rem' }}>
      <table
        data-testid="main-articles-table"
        style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}
      >
        <thead>
          <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
            <th
              style={{
                padding: '1rem 1.5rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              TÍTULO
            </th>
            <th
              style={{
                padding: '1rem 1.5rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              AUTORES
            </th>
            <th
              style={{
                padding: '1rem 1.5rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              BASES
            </th>
            <th
              style={{
                padding: '1rem 1.5rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              AÇÕES
            </th>
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
              <td style={{ padding: '1.25rem 1.5rem', maxWidth: '350px' }}>
                <div
                  onClick={() => setSelectedArticleForDetails(article)}
                  style={{
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    marginBottom: '0.25rem',
                    lineHeight: '1.4',
                    transition: 'color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'color-mix(in srgb, var(--color-primary) 80%, black)';
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-primary)';
                    e.currentTarget.style.textDecoration = 'none';
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
                <div style={{ marginBottom: '0.4rem', fontWeight: 500 }}>
                  {article.authors || 'Autores desconhecidos'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="var(--text-muted)" /> {article.year || 'N/A'}
                  </div>
                  {article.citation_count !== undefined && article.citation_count !== null && (
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                        background: 'var(--bg-main)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      🎓 {article.citation_count} {article.citation_count === 1 ? 'citação' : 'citações'}
                    </span>
                  )}
                </div>
              </td>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {article.source_databases ? (
                    JSON.parse(article.source_databases as string).map((base: string) => {
                      const isManual = base === 'Manual';
                      return (
                        <span
                          key={base}
                          style={{
                            padding: '0.2rem 0.6rem',
                            background: isManual ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)',
                            border: isManual
                              ? '1px solid var(--color-danger)'
                              : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-xl)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isManual ? 'var(--color-danger)' : 'var(--color-primary)',
                          }}
                          title={
                            isManual ? 'Metadados adicionados manualmente (podem conter erros)' : undefined
                          }
                        >
                          {isManual ? '⚠️ Manual' : base}
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
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
                  {article.local_file_path ? (
                    <>
                      <Link
                        to={`/articles/${article.id}`}
                        className="btn-primary"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        <FileText size={14} /> Ler
                      </Link>
                      <button
                        onClick={() => handleUnlinkClick(article.id)}
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                        title="Desvincular PDF"
                      >
                        <XIcon size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUploadClick(article.id)}
                      disabled={uploadingId === article.id}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      title="Vincular PDF"
                    >
                      {uploadingId === article.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}{' '}
                      PDF
                    </button>
                  )}

                  {article.status === 'read' ? (
                    <button
                      onClick={() => handleStatusChange(article.id, 'new')}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      title="Desmarcar como Lido"
                    >
                      <CheckCircle size={14} /> Desmarcar
                    </button>
                  ) : article.status !== 'archived' ? (
                    <button
                      onClick={() => handleStatusChange(article.id, 'read')}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      title="Marcar como Lido"
                    >
                      <CheckCircle size={14} /> Lido
                    </button>
                  ) : null}

                  {isArticleManual(article) && (
                    <button
                      onClick={() => setEditingArticle(article)}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      title="Editar Metadados"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                  )}

                  {article.status === 'archived' ? (
                    <button
                      onClick={() => handleStatusChange(article.id, 'new')}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      title="Restaurar Artigo"
                    >
                      <History size={14} /> Restaurar
                    </button>
                  ) : (
                    <button
                      onClick={() => setArchivingId(article.id)}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                      title="Arquivar"
                    >
                      <Archive size={14} /> Arquivar
                    </button>
                  )}

                  <button
                    onClick={() => setCitationArticle(article)}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                    title="Gerar Citação"
                  >
                    <CopyPlus size={14} /> Citar
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
