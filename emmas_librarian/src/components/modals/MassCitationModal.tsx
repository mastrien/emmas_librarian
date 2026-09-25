import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check } from 'lucide-react';
import { generateCitation } from '../../services/citationService';
import { Article } from '../../types';
import {
  citationFieldsFromArticle,
  toCitableArticle,
  type CitableArticle,
  type CitationFields,
} from '../../utils/cslMetadata';
import { useCitationCopy } from '../common/citation/useCitationCopy';
import { MassCitationControls, type MassCitationSettings } from './massCitation/MassCitationControls';
import { MassCitationList, type RenderedCitation } from './massCitation/MassCitationList';
import { MassCitationEditPanel } from './massCitation/MassCitationEditPanel';
import { sortCitableArticles } from './massCitation/sortCitableArticles';
import { useMassCitationEditor } from './massCitation/useMassCitationEditor';

interface MassCitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  onArticlesUpdated?: () => void;
}

const DEFAULT_SETTINGS: MassCitationSettings = { style: 'abnt', format: 'html', sortBy: 'author', useEtAl: true };

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
};

const cardStyle: React.CSSProperties = {
  maxWidth: '850px',
  width: '90%',
  maxHeight: '90vh',
  overflow: 'hidden',
  background: 'var(--bg-main)',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 'var(--radius-lg)',
};

/**
 * Bibliography for a set of articles (the project's read ones), with per-reference metadata editing.
 *
 * Usage:
 *   <MassCitationModal isOpen={open} onClose={close} articles={readArticles} onArticlesUpdated={reload} />
 */
export function MassCitationModal({ isOpen, onClose, articles, onArticlesUpdated }: MassCitationModalProps) {
  const [settings, setSettings] = useState<MassCitationSettings>(DEFAULT_SETTINGS);
  const [citable, setCitable] = useState<CitableArticle[]>([]);
  const { copied, copy } = useCitationCopy();
  const editor = useMassCitationEditor({
    originalFields: (id) => {
      const original = articles.find((art) => art.id === id);
      return original && citationFieldsFromArticle(original);
    },
    onSaved: (id: number, fields: CitationFields) => {
      setCitable((prev) => prev.map((art) => (art.id === id ? { ...art, ...fields } : art)));
      onArticlesUpdated?.();
    },
  });

  useEffect(() => {
    if (!isOpen || !articles) return;
    setCitable(articles.map(toCitableArticle));
    editor.close();
    setSettings((prev) => ({ ...prev, useEtAl: true }));
  }, [isOpen, articles]);

  const sorted = useMemo(() => sortCitableArticles(citable, settings.sortBy), [citable, settings.sortBy]);
  const citations = useMemo<RenderedCitation[]>(
    () =>
      sorted.map((art) => ({
        articleId: art.id,
        text: generateCitation(art, settings.style, settings.format, settings.useEtAl),
      })),
    [sorted, settings],
  );

  if (!isOpen) return null;

  const startEdit = (articleId: number) => {
    const article = citable.find((art) => art.id === articleId);
    if (article) editor.start(article);
  };

  const copyAll = () => {
    if (citations.length === 0) return;
    copy(
      citations.map((c) => c.text),
      settings.format,
    );
  };

  return createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div className="card fade-in" onClick={(e) => e.stopPropagation()} style={cardStyle}>
        <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}
          >
            <h2 style={{ margin: 0, color: 'var(--text-heading)' }}>Citação em Massa (Artigos Lidos)</h2>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          {editor.editing ? (
            <MassCitationEditPanel
              fields={editor.editing.fields}
              saving={editor.saving}
              onFieldChange={editor.setField}
              onCancel={editor.close}
              onReset={editor.reset}
              onSave={editor.save}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <MassCitationControls settings={settings} onChange={setSettings} />
              <MassCitationList citations={citations} format={settings.format} onEdit={startEdit} />
              <MassCitationFooter copied={copied} canCopy={citations.length > 0} onClose={onClose} onCopy={copyAll} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface MassCitationFooterProps {
  copied: boolean;
  canCopy: boolean;
  onClose: () => void;
  onCopy: () => void;
}

const MassCitationFooter: React.FC<MassCitationFooterProps> = ({ copied, canCopy, onClose, onCopy }) => (
  <div
    style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignSelf: 'flex-end', marginTop: '0.5rem' }}
  >
    <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1.5rem' }}>
      Fechar
    </button>
    <button
      onClick={onCopy}
      disabled={!canCopy}
      className="btn-primary"
      style={{ padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? 'Copiado!' : 'Copiar Todas'}
    </button>
  </div>
);
