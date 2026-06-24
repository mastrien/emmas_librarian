import React from 'react';
import { AlertCircle, Loader2, Upload, ExternalLink, Calendar, BookOpen } from 'lucide-react';
import { Article } from '../../types';

interface PdfPlaceholderViewProps {
  article: Article;
  uploading: boolean;
  onFileUpload: () => void;
}

export const PdfPlaceholderView: React.FC<PdfPlaceholderViewProps> = ({ article, uploading, onFileUpload }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        color: 'var(--text-main)',
        gap: '2rem',
        padding: '3rem 2rem',
        overflowY: 'auto',
        background: 'var(--bg-main)',
      }}
    >
      {/* Warning Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '750px',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <AlertCircle size={28} color="#d97706" style={{ flexShrink: 0 }} />
        <div>
          <h4 style={{ margin: '0 0 0.25rem 0', color: '#b45309', fontSize: '1rem', fontWeight: 600 }}>
            Nenhum PDF vinculado a este artigo
          </h4>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Faça o upload do arquivo PDF deste artigo para começar a ler, sublinhar e fazer destaques diretamente no
            Emma's Librarian.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '750px',
        }}
      >
        <button
          onClick={onFileUpload}
          disabled={uploading}
          className="btn-primary"
          style={{
            fontSize: '0.95rem',
            padding: '0.6rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          Vincular PDF Local
        </button>

        {article.doi && (
          <a
            href={`https://doi.org/${article.doi}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
            style={{
              fontSize: '0.95rem',
              padding: '0.6rem 1.5rem',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-heading)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
            }}
          >
            <ExternalLink size={18} /> Buscar por DOI
          </a>
        )}
      </div>

      {/* Metadata Card & Abstract Preview */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '750px',
          padding: '2rem',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-surface)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
              marginBottom: '0.5rem',
              letterSpacing: '0.05em',
            }}
          >
            METADADOS DE REFERÊNCIA
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-heading)', fontSize: '1.35rem', lineHeight: '1.3' }}>
            {article.title}
          </h3>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
              marginTop: '0.75rem',
            }}
          >
            {article.year && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Calendar size={15} /> {article.year}
              </span>
            )}
            {article.journal && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontStyle: 'italic' }}>
                <BookOpen size={15} /> {article.journal}
              </span>
            )}
          </div>
          {article.authors && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              <strong>Autores:</strong> {article.authors}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-heading)', fontSize: '0.95rem', fontWeight: 600 }}>
            Resumo / Abstract
          </h4>
          <div
            style={{
              fontSize: '0.95rem',
              color: 'var(--text-main)',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}
          >
            {article.abstract || 'Nenhum resumo disponível nas buscas para este artigo.'}
          </div>
        </div>
      </div>
    </div>
  );
};
