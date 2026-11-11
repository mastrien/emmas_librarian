import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
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
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';

interface MassCitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  onArticlesUpdated?: () => void;
}

const DEFAULT_SETTINGS: MassCitationSettings = { style: 'abnt', format: 'html', sortBy: 'author', useEtAl: true };

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

  return (
    <Modal
      label="Citação em massa"
      title={`Citar ${articles.length} ${articles.length === 1 ? 'artigo' : 'artigos'}`}
      description="Os artigos lidos do projeto"
      onClose={onClose}
      width={850}
    >
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
          <MassCitationFooter copied={copied} canCopy={citations.length > 0} onCopy={copyAll} />
        </div>
      )}
    </Modal>
  );
}

interface MassCitationFooterProps {
  copied: boolean;
  canCopy: boolean;
  onCopy: () => void;
}

const MassCitationFooter: React.FC<MassCitationFooterProps> = ({ copied, canCopy, onCopy }) => (
  <ModalFooter>
    <Button variant="primary" className={copied ? 'app-modal-copied' : undefined} onClick={onCopy} disabled={!canCopy}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {copied ? 'Copiado!' : 'Copiar tudo'}
    </Button>
  </ModalFooter>
);
