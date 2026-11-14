import { useState, useEffect } from 'react';
import { generateCitation, CitationStyle, CitationOutputFormat } from '../../services/citationService';
import { Copy, Check, FileText, Code, Braces, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import {
  citationFieldsFromArticle,
  citationFieldsToMetadata,
  tryCitationFieldsFromCsl,
  type CitationFields,
} from '../../utils/cslMetadata';
import { CitationMetadataFields } from '../common/citation/CitationMetadataFields';
import { CITATION_STYLE_OPTIONS } from '../common/citation/citationStyles';
import { useCitationCopy } from '../common/citation/useCitationCopy';
import { useDialogs } from '../common/dialogs/DialogProvider';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: import('../../types').Article | null;
  onArticleUpdated?: () => void;
}

/**
 * Formatted citation for one article, with inline editing of the metadata it is built from.
 *
 * Usage:
 *   <CitationModal isOpen={open} onClose={close} article={article} onArticleUpdated={reload} />
 */
export function CitationModal({ isOpen, onClose, article, onArticleUpdated }: CitationModalProps) {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  const [style, setStyle] = useState<CitationStyle>('abnt');
  const [format, setFormat] = useState<CitationOutputFormat>('html');
  const [citationText, setCitationText] = useState('');
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [fields, setFields] = useState<CitationFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [useEtAl, setUseEtAl] = useState(true);
  const { copied, copy } = useCitationCopy();

  useEffect(() => {
    if (!isOpen || !article) return;
    setFields(citationFieldsFromArticle(article));
    setIsAccordionOpen(false);
    setUseEtAl(true);
  }, [isOpen, article]);

  useEffect(() => {
    if (!isOpen || !article || !fields) return;
    setCitationText(generateCitation({ ...article, ...fields }, style, format, useEtAl));
  }, [isOpen, article, fields, style, format, useEtAl]);

  if (!isOpen || !article || !fields) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectService.updateArticleMetadata(article.id, citationFieldsToMetadata(fields));
      onArticleUpdated?.();
      await inform({ title: 'Metadados salvos', message: 'Metadados salvos com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar metadados:', err);
      await inform({ title: 'Erro ao salvar', message: 'Erro ao salvar metadados.' });
    } finally {
      setSaving(false);
    }
  };

  // Prefer the metadata the article was imported with; without it, go back to the saved values.
  const handleReset = () => setFields(tryCitationFieldsFromCsl(article.csl_json) ?? citationFieldsFromArticle(article));

  const setField = (field: keyof CitationFields, value: string) => setFields({ ...fields, [field]: value });

  return (
    <Modal label="Citar artigo" title="Citar artigo" description={article.title} onClose={onClose} width={700}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estilo da Citação:</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as CitationStyle)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                outline: 'none',
                background: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
              }}
            >
              {CITATION_STYLE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              color: 'var(--text-main)',
            }}
          >
            <input
              type="checkbox"
              checked={useEtAl}
              onChange={(e) => setUseEtAl(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Usar "et al." para múltiplos autores
          </label>
        </div>

        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <button
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'var(--bg-surface)',
              border: 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              color: 'var(--text-heading)',
              fontWeight: 600,
            }}
          >
            Metadados do Artigo (Clique para Editar)
            {isAccordionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <div
            style={{
              maxHeight: isAccordionOpen ? '1000px' : '0',
              opacity: isAccordionOpen ? 1 : 0,
              overflow: 'hidden',
              transition: 'all 0.3s ease-in-out',
              background: 'var(--bg-main)',
            }}
          >
            <div
              style={{
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <CitationMetadataFields fields={fields} onChange={setField} />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-secondary"
                  style={{
                    padding: '0.4rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <RotateCcw size={14} /> Resetar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                  style={{
                    padding: '0.4rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Metadados'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.5rem',
            }}
          >
            <button
              onClick={() => setFormat('html')}
              className={format === 'html' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <FileText size={16} /> Visualização (HTML)
            </button>
            <button
              onClick={() => setFormat('text')}
              className={format === 'text' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Code size={16} /> Texto Simples
            </button>
            <button
              onClick={() => setFormat('bibtex')}
              className={format === 'bibtex' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Braces size={16} /> BibTeX / LaTeX
            </button>
          </div>

          <div>
            <div
              data-testid="citation-preview"
              style={{
                padding: '1.5rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                minHeight: '120px',
                maxHeight: '300px',
                overflowY: 'auto',
                whiteSpace: format === 'html' ? 'normal' : 'pre-wrap',
                fontFamily: format === 'html' ? 'inherit' : 'var(--font-mono)',
                fontSize: format === 'html' ? '1rem' : '0.9rem',
                lineHeight: '1.6',
              }}
            >
              {format === 'html' ? <div dangerouslySetInnerHTML={{ __html: citationText }} /> : citationText}
            </div>
          </div>
        </div>
      </div>
      <ModalFooter>
        <Button
          variant="primary"
          className={copied ? 'app-modal-copied' : undefined}
          onClick={() => copy([citationText], format)}
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
