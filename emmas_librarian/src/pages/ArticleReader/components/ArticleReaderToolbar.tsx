import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Edit2, CopyPlus, Loader2, Upload, ZoomOut, ZoomIn, X as XIcon } from 'lucide-react';
import { HelpButton } from '../../../components/common/HelpButton';
import type { Article } from '../../../types';

interface ArticleReaderToolbarProps {
  article: Article;
  hasLocalFile: boolean;
  uploading: boolean;
  scale: number;
  handleZoom: (updater: number | ((s: number) => number)) => void;
  handleFileUpload: () => void;
  handleUnlinkClick: () => void;
  setIsEditingMetadata: (val: boolean) => void;
  setIsCitationModalOpen: (val: boolean) => void;
}

export const ArticleReaderToolbar: React.FC<ArticleReaderToolbarProps> = ({
  article,
  hasLocalFile,
  uploading,
  scale,
  handleZoom,
  handleFileUpload,
  handleUnlinkClick,
  setIsEditingMetadata,
  setIsCitationModalOpen,
}) => {
  const isArticleManual = (article: Article) => {
    try {
      return JSON.parse(article.source_databases as string).includes('Manual');
    } catch {
      return false;
    }
  };

  return (
    <header
      className="glass-panel"
      style={{
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        borderRadius: 0,
        boxShadow: 'var(--shadow-sm)',
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
        <Link
          to={`/projects/${article.project_id}`}
          style={{
            textDecoration: 'none',
            color: 'var(--text-muted)',
            flexShrink: 0,
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-main)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ArrowLeft size={20} />
        </Link>
        <h2
          style={{
            margin: 0,
            fontSize: '1.25rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--text-heading)',
          }}
        >
          {article.title}
        </h2>
        {isArticleManual(article) && (
          <button
            onClick={() => setIsEditingMetadata(true)}
            className="btn-secondary"
            style={{
              padding: '0.3rem 0.6rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
            title="Editar Metadados"
          >
            <Edit2 size={14} /> Editar Metadados
          </button>
        )}
        <button
          onClick={() => setIsCitationModalOpen(true)}
          className="btn-secondary"
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
          title="Gerar Citação"
        >
          <CopyPlus size={14} /> Citar
        </button>
        <HelpButton style={{ marginLeft: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} />
      </div>

      {!hasLocalFile ? (
        <div>
          <button
            onClick={handleFileUpload}
            disabled={uploading}
            className="btn-primary"
            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Vincular PDF Local
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
            }}
          >
            <button
              onClick={() => handleZoom((s) => Math.max(0.5, parseFloat((s - 0.1).toFixed(1))))}
              style={{ background: 'none', border: 'none', color: 'var(--text-heading)', cursor: 'pointer' }}
              title="Menos zoom"
            >
              <ZoomOut size={18} />
            </button>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                minWidth: '40px',
                textAlign: 'center',
              }}
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => handleZoom((s) => Math.min(2.5, parseFloat((s + 0.1).toFixed(1))))}
              style={{ background: 'none', border: 'none', color: 'var(--text-heading)', cursor: 'pointer' }}
              title="Mais zoom"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={() => handleZoom(1.0)}
              className="btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px' }}
            >
              Reset
            </button>
          </div>

          <button
            onClick={handleUnlinkClick}
            className="btn-secondary"
            style={{
              color: 'var(--color-danger)',
              fontSize: '0.9rem',
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <XIcon size={16} /> Desvincular PDF
          </button>
        </div>
      )}
    </header>
  );
};
