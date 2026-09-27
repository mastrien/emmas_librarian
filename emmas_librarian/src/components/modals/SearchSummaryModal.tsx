import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Loader2, Save, Trash2, X } from 'lucide-react';
import type { SearchPreview, SearchPreviewItem } from '../../types';
import { ArticleDetailsModal } from './ArticleDetailsModal';
import { previewItemToArticle } from './searchSummary/previewItemToArticle';
import { SearchBreakdownList } from './searchSummary/SearchBreakdownList';
import { SearchPreviewList } from './searchSummary/SearchPreviewList';

interface SearchSummaryModalProps {
  preview: SearchPreview;
  isSaving: boolean;
  // Shown inside the dialog: the page behind it is covered by the overlay.
  saveError?: string | null;
  onSave: () => void;
  onDiscard: () => void;
}

const statBoxStyle: React.CSSProperties = {
  background: 'var(--bg-main)',
  padding: '1rem',
  borderRadius: 'var(--radius-lg)',
  textAlign: 'center',
};

const StatBox: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div style={statBoxStyle}>
    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? 'var(--text-heading)' }}>{value}</div>
  </div>
);

const SummaryHeader: React.FC = () => (
  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
    <div
      style={{
        background: 'var(--color-success)',
        color: 'white',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1rem',
      }}
    >
      <CheckCircle size={34} />
    </div>
    <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>Busca Concluída!</h2>
    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
      Nada foi salvo ainda. Revise os resultados e escolha se eles entram no projeto.
    </p>
  </div>
);

const SummaryActions: React.FC<Omit<SearchSummaryModalProps, 'preview' | 'saveError'>> = ({
  isSaving,
  onSave,
  onDiscard,
}) => (
  <div style={{ display: 'flex', gap: '1rem' }}>
    <button onClick={onDiscard} disabled={isSaving} className="btn-secondary" style={{ flex: 1, padding: '1rem' }}>
      <Trash2 size={18} /> Descartar
    </button>
    <button onClick={onSave} disabled={isSaving} className="btn-primary" style={{ flex: 2, padding: '1rem' }}>
      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar no projeto
    </button>
  </div>
);

/**
 * Results of a search that is not saved yet: counts, per-database outcome and the article list,
 * with the choice to save them into the project or discard them and refine the query.
 *
 * @example <SearchSummaryModal preview={preview} isSaving={false} onSave={save} onDiscard={discard} />
 */
export const SearchSummaryModal: React.FC<SearchSummaryModalProps> = ({
  preview,
  isSaving,
  saveError,
  onSave,
  onDiscard,
}) => {
  const totalFound = Object.values(preview.breakdown).reduce((sum, db) => sum + db.count, 0);
  const alreadyInProject = preview.results.filter((r) => r.alreadyInProject).length;
  const [detailsItem, setDetailsItem] = useState<SearchPreviewItem | null>(null);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Busca Concluída"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="card fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          padding: '2rem 2.5rem',
          position: 'relative',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Closing is the same as discarding: nothing half-saved is left behind. */}
        <button
          onClick={onDiscard}
          disabled={isSaving}
          aria-label="Fechar e descartar"
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={24} />
        </button>
        <SummaryHeader />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatBox label="Total Encontrado" value={totalFound} />
          <StatBox label="Sem Duplicatas" value={preview.results.length} color="var(--color-primary)" />
          <StatBox label="Já no Projeto" value={alreadyInProject} />
        </div>
        <SearchBreakdownList breakdown={preview.breakdown} />
        <SearchPreviewList results={preview.results} onOpenDetails={setDetailsItem} />
        {saveError && (
          <p role="alert" style={{ color: 'var(--color-danger)', margin: '0 0 1rem 0' }}>
            {saveError}
          </p>
        )}
        <SummaryActions isSaving={isSaving} onSave={onSave} onDiscard={onDiscard} />
      </div>
      <ArticleDetailsModal
        isOpen={detailsItem !== null}
        onClose={() => setDetailsItem(null)}
        article={detailsItem ? previewItemToArticle(detailsItem) : null}
        isSearchResult
      />
    </div>,
    document.body,
  );
};
