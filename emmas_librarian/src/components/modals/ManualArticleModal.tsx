import React, { useState } from 'react';
import { failureNotice } from '../common/dialogs/failureNotice';
import { X as XIcon, Upload, Loader2, Plus } from 'lucide-react';
import type { Article } from '../../types';
import { useProjectService } from '../../contexts/ServicesContext';
import { fileNameFromPath } from '../../utils/formatters';
import { LabeledField } from '../common/LabeledField';
import { AUTHORS_SEPARATOR_HINT } from '../common/articleFieldHints';
import { Modal } from '../common/Modal';
import { useDialogs } from '../common/dialogs/DialogProvider';
import {
  articleFromForm,
  EMPTY_ARTICLE_FIELDS,
  TITLE_REQUIRED,
  type ArticleFormFields,
} from './articleForm/articleFormData';

interface ManualArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Article>, filePath?: string) => Promise<void>;
}

const PdfPicker: React.FC<{ filePath?: string; onPick: () => void; onClear: () => void }> = (props) => (
  <div>
    <label
      style={{
        display: 'block',
        fontSize: '0.85rem',
        fontWeight: 600,
        marginBottom: '0.3rem',
        color: 'var(--text-muted)',
      }}
    >
      Documento PDF (Opcional)
    </label>
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <button
        type="button"
        onClick={props.onPick}
        className="btn-secondary"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
      >
        <Upload size={16} /> {props.filePath ? 'Alterar PDF' : 'Selecionar PDF'}
      </button>
      {props.filePath && (
        <>
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
            title={props.filePath}
          >
            {fileNameFromPath(props.filePath)}
          </div>
          <button
            type="button"
            onClick={props.onClear}
            className="btn-secondary"
            style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
            title="Remover PDF"
          >
            <XIcon size={16} />
          </button>
        </>
      )}
    </div>
  </div>
);

// Mounted only while open, so every opening starts from an empty form.
const ManualArticleForm: React.FC<Omit<ManualArticleModalProps, 'isOpen'>> = ({ onClose, onSubmit }) => {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  const [fields, setFields] = useState<ArticleFormFields>(EMPTY_ARTICLE_FIELDS);
  const [filePath, setFilePath] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof ArticleFormFields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  const handleSelectFile = async () => {
    try {
      const selected = await projectService.openPdfDialog();
      if (selected) setFilePath(selected);
    } catch {
      await inform({ title: 'Documento PDF', message: 'Erro ao selecionar o arquivo PDF' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.title.trim()) return void inform({ title: 'Adicionar artigo', message: TITLE_REQUIRED });
    setSubmitting(true);
    try {
      await onSubmit(articleFromForm(fields), filePath);
      onClose();
    } catch (err: unknown) {
      await inform(failureNotice('Não conseguimos adicionar o artigo', 'O artigo não entrou no projeto.', err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      label="Adicionar Artigo Avulso"
      title="Adicionar Artigo Avulso"
      onClose={onClose}
      busy={submitting}
      width={550}
    >
      <div
        style={{
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          fontSize: '0.85rem',
          color: 'var(--color-danger)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <span>⚠️</span>
        <span>
          <strong>Atenção:</strong> Artigos adicionados de forma avulsa podem conter metadados incorretos ou
          incompletos.
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <LabeledField
          label="Título *"
          value={fields.title}
          onChange={set('title')}
          placeholder="Ex: A New Approach to Bibliometrics"
          required
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <LabeledField
            label="Autores"
            value={fields.authors}
            onChange={set('authors')}
            placeholder="Ex: John Doe, Jane Smith"
            hint={AUTHORS_SEPARATOR_HINT}
          />
          <LabeledField label="Ano" type="number" value={fields.year} onChange={set('year')} placeholder="Ex: 2026" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <LabeledField label="DOI" value={fields.doi} onChange={set('doi')} placeholder="Ex: 10.1000/xyz123" />
          <LabeledField
            label="Revista / Periódico"
            value={fields.journal}
            onChange={set('journal')}
            placeholder="Ex: Nature"
          />
        </div>
        <LabeledField
          label="Resumo"
          value={fields.abstract}
          onChange={set('abstract')}
          placeholder="Resumo do artigo..."
          multiline
          reading
          textareaHeight="80px"
        />
        <PdfPicker filePath={filePath} onPick={handleSelectFile} onClear={() => setFilePath(undefined)} />

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Salvar Artigo
          </button>
        </div>
      </form>
    </Modal>
  );
};

/**
 * Adds an article by hand, optionally with a PDF. Its metadata may be wrong or incomplete, which the window says.
 *
 * @example <ManualArticleModal isOpen={open} onClose={close} onSubmit={(data, pdf) => create(data, pdf)} />
 */
export const ManualArticleModal: React.FC<ManualArticleModalProps> = ({ isOpen, ...props }) =>
  isOpen ? <ManualArticleForm {...props} /> : null;
