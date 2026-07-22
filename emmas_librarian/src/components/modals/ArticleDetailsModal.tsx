import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  X,
  Calendar,
  User,
  BookOpen,
  Link as LinkIcon,
  Tag,
  Unlock,
  Lock,
  GraduationCap,
  Building,
  Layers,
  Hash,
  Bookmark,
  Upload,
  Eye,
  Trash2,
} from 'lucide-react';
import { Article } from '../../types';
import { useProjectService } from '../../contexts/ServicesContext';

interface ArticleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article | null;
  history?: any[];
  onNavigateToSearch?: (searchId: number) => void;
  onArticleUpdated?: () => void;
  onAttachPdf?: (article: Article) => void;
}

export const ArticleDetailsModal: React.FC<ArticleDetailsModalProps> = ({
  isOpen,
  onClose,
  article,
  history = [],
  onNavigateToSearch,
  onArticleUpdated,
  onAttachPdf,
}) => {
  if (!isOpen || !article) return null;

  const isOa = article.is_oa === 1;

  const originSearch = article.search_id && history
    ? history.find((h) => h.id === article.search_id)
    : null;

  const projectService = useProjectService();

  const handleUnlinkPdf = async () => {
    if (window.confirm('Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.')) {
      try {
        await projectService.unlinkPdf(article.id);
        if (onArticleUpdated) onArticleUpdated();
      } catch (err) {
        alert('Erro ao desvincular o PDF: ' + err);
      }
    }
  };

  // Helper to parse keywords
  const parseKeywords = (keywordsStr?: string): string[] => {
    if (!keywordsStr) return [];
    return keywordsStr
      .split(';')
      .map((k) => k.trim())
      .filter(Boolean);
  };

  const authorKeywords = parseKeywords(article.author_keywords);
  const indexKeywords = parseKeywords(article.index_keywords);

  // Helper to parse databases
  const parseDatabases = (dbStr?: string): string[] => {
    if (!dbStr) return [];
    try {
      return typeof dbStr === 'string' ? JSON.parse(dbStr) : dbStr;
    } catch {
      return [dbStr];
    }
  };

  const databases = parseDatabases(article.source_databases);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
      onClick={onClose}
    >
      <div
        className="card fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '800px',
          width: '95%',
          maxHeight: '85vh',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '2.5rem 2.5rem 1rem 2.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            flex: 1,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {databases.map((db) => (
                  <span
                    key={db}
                    style={{
                      padding: '0.2rem 0.6rem',
                      background: 'rgba(79, 70, 229, 0.1)',
                      border: '1px solid var(--color-primary)',
                      borderRadius: 'var(--radius-xl)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                    }}
                  >
                    {db}
                  </span>
                ))}
                <span
                  style={{
                    padding: '0.2rem 0.6rem',
                    background: isOa ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                    border: isOa ? '1px solid var(--color-success, #10b981)' : '1px solid var(--text-muted)',
                    borderRadius: 'var(--radius-xl)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isOa ? 'var(--color-success, #10b981)' : 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {isOa ? <Unlock size={12} /> : <Lock size={12} />}
                  {isOa ? 'Acesso Aberto' : 'Acesso Fechado'}
                </span>
              </div>
              <h2 style={{ margin: 0, color: 'var(--text-heading)', fontSize: '1.5rem', lineHeight: '1.3' }}>
                {article.title}
              </h2>
            </div>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.2rem',
                borderRadius: '50%',
                transition: 'background var(--transition-fast)',
              }}
              onClick={onClose}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'visible' }}>
            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>AUTORES</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{article.authors || 'N/A'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ANO DE PUBLICAÇÃO
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{article.year || 'N/A'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    REVISTA / PERIÓDICO
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                    {article.journal || 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Hash size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    VOLUME / EDIÇÃO / PÁGINAS
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {article.volume ? `v. ${article.volume}` : ''}
                    {article.issue ? `, n. ${article.issue}` : ''}
                    {article.pages ? `, p. ${article.pages}` : ''}
                    {!article.volume && !article.issue && !article.pages ? 'N/A' : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    TIPO DE DOCUMENTO
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>
                    {article.document_type || 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    EDITORA (PUBLISHER)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{article.publisher || 'N/A'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GraduationCap size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CITAÇÕES</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
                    🎓{' '}
                    {article.citation_count !== undefined && article.citation_count !== null
                      ? article.citation_count
                      : '0'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LinkIcon size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DOI</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                    {article.doi ? (
                      <a
                        href={`https://doi.org/${article.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {article.doi}
                      </a>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
              </div>

              {article.issn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bookmark size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ISSN</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{article.issn}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Origin */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}
              >
                ORIGEM NO PROJETO
              </div>
              {article.search_id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {originSearch ? (
                    <button
                      onClick={() => onNavigateToSearch && onNavigateToSearch(article.search_id!)}
                      style={{
                        background: 'rgba(79, 70, 229, 0.1)',
                        border: '1px solid var(--color-primary)',
                        color: 'var(--color-primary)',
                        padding: '0.3rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-primary)';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(79, 70, 229, 0.1)';
                        e.currentTarget.style.color = 'var(--color-primary)';
                      }}
                    >
                      {originSearch.unified_query.startsWith('Importação') ? (
                        <>📦 Importação #{article.search_id}</>
                      ) : (
                        <>🔍 Busca #{article.search_id}</>
                      )}
                      {" - "}
                      {originSearch.unified_query}
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      Busca #{article.search_id} (Histórico carregando...)
                    </span>
                  )}
                </div>
              ) : (
                <span
                  style={{
                    padding: '0.2rem 0.6rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid #f59e0b',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#f59e0b',
                    display: 'inline-block',
                  }}
                >
                  Cadastro Manual ⚠️
                </span>
              )}
            </div>

            {/* Arquivo PDF */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}
              >
                ARQUIVO PDF
              </div>
              {article.local_file_path ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Link
                    to={`/articles/${article.id}`}
                    onClick={onClose}
                    className="btn-primary"
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Eye size={14} /> Visualizar PDF
                  </Link>
                  <button
                    onClick={handleUnlinkPdf}
                    className="btn-secondary"
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--color-danger)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      background: 'rgba(239, 68, 68, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} /> Desvincular PDF
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => onAttachPdf && onAttachPdf(article)}
                    className="btn-secondary"
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Upload size={14} /> Anexar PDF
                  </button>
                </div>
              )}
            </div>

            {/* Affiliations */}
            {article.affiliations && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}
                >
                  AFILIAÇÕES
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                  {article.affiliations}
                </div>
              </div>
            )}

            {/* Abstract */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
                RESUMO (ABSTRACT)
              </div>
              <div
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-main)',
                  lineHeight: '1.6',
                  background: 'var(--bg-surface)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {article.abstract || 'Nenhum resumo disponível para este artigo.'}
              </div>
            </div>

            {/* Keywords */}
            {(authorKeywords.length > 0 || indexKeywords.length > 0) && (
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {authorKeywords.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        marginBottom: '0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Tag size={12} /> PALAVRAS-CHAVE DO AUTOR
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {authorKeywords.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '0.2rem 0.5rem',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            color: 'var(--text-main)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {indexKeywords.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        marginBottom: '0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Tag size={12} /> PALAVRAS-CHAVE INDEXADAS
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {indexKeywords.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '0.2rem 0.5rem',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            color: 'var(--text-main)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* References */}
            {article.references_list && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}
                >
                  REFERÊNCIAS CITADAS
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-main)',
                    lineHeight: '1.5',
                    background: 'var(--bg-surface)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {article.references_list.split(';').map((ref, idx) => (
                      <li key={idx} style={{ marginBottom: '0.5rem' }}>
                        {ref.trim()}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--border-color)',
            padding: '1rem 2.5rem 1.5rem 2.5rem',
            background: 'var(--bg-main)',
          }}
        >
          <button onClick={onClose} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
