import { useState, useEffect } from 'react';
import { generateCitation } from '../../services/citationService';
import { Copy, Check } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import {
  citationFieldsFromArticle,
  citationFieldsToMetadata,
  tryCitationFieldsFromCsl,
  type CitationFields,
} from '../../utils/cslMetadata';
import {
  CITATION_CHOICES,
  readRememberedChoice,
  rememberChoice,
  renderingOf,
  type CitationChoice,
} from '../common/citation/citationChoice';
import { useCitationCopy } from '../common/citation/useCitationCopy';
import { useDialogs } from '../common/dialogs/DialogProvider';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
import { SegmentedControl } from '../common/SegmentedControl';
import { CitationPreview } from './citation/CitationPreview';
import { CitationMetadataEditor } from './citation/CitationMetadataEditor';
import './modalForms.css';
import './citation/citation.css';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: import('../../types').Article | null;
  onArticleUpdated?: () => void;
}

/**
 * Formatted citation for one article (board 177), with a second view to edit the metadata it is built from.
 *
 * Usage:
 *   <CitationModal isOpen={open} onClose={close} article={article} onArticleUpdated={reload} />
 */
export function CitationModal({ isOpen, onClose, article, onArticleUpdated }: CitationModalProps) {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  const [choice, setChoice] = useState<CitationChoice>(readRememberedChoice);
  const [citationText, setCitationText] = useState('');
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<CitationFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [useEtAl, setUseEtAl] = useState(true);
  const { copied, copy } = useCitationCopy();
  const { style, format } = renderingOf(choice);

  useEffect(() => {
    if (!isOpen || !article) return;
    setFields(citationFieldsFromArticle(article));
    setEditing(false);
    setUseEtAl(true);
    setChoice(readRememberedChoice());
  }, [isOpen, article]);

  useEffect(() => {
    if (!isOpen || !article || !fields) return;
    setCitationText(generateCitation({ ...article, ...fields }, style, format, useEtAl));
  }, [isOpen, article, fields, style, format, useEtAl]);

  if (!isOpen || !article || !fields) return null;

  const pick = (next: CitationChoice) => {
    setChoice(next);
    rememberChoice(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectService.updateArticleMetadata(article.id, citationFieldsToMetadata(fields));
      onArticleUpdated?.();
      await inform({ title: 'Metadados salvos', message: 'Metadados salvos com sucesso!' });
      setEditing(false);
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
    <Modal
      label="Citar artigo"
      title="Citar artigo"
      description={article.title}
      onClose={onClose}
      width={editing ? 560 : 460}
    >
      {editing ? (
        <CitationMetadataEditor
          fields={fields}
          saving={saving}
          onChange={setField}
          onReset={handleReset}
          onBack={() => setEditing(false)}
          onSave={handleSave}
        />
      ) : (
        <>
          <div className="modal-form">
            <SegmentedControl<CitationChoice>
              label="Formato da citação"
              options={[...CITATION_CHOICES]}
              value={choice}
              onChange={pick}
            />
            <CitationPreview text={citationText} format={format} />
            <label className="citation-option">
              <input type="checkbox" checked={useEtAl} onChange={(e) => setUseEtAl(e.target.checked)} />
              Usar &quot;et al.&quot; para múltiplos autores
            </label>
          </div>
          <ModalFooter hint="Lembra o último formato">
            <Button onClick={() => setEditing(true)}>Editar metadados</Button>
            <Button
              variant="primary"
              className={copied ? 'app-modal-copied' : undefined}
              onClick={() => copy([citationText], format)}
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
