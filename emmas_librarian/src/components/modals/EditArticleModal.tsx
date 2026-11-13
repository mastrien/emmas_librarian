import React, { useState } from 'react';
import { failureNotice } from '../common/dialogs/failureNotice';
import { Loader2, Save, Sparkles } from 'lucide-react';
import { Article } from '../../types';
import { useProjectService } from '../../contexts/ServicesContext';
import { useGlobalError } from '../../contexts/GlobalErrorContext';
import type { FrontendAppError } from '../../utils/AppError';
import { LabeledField } from '../common/LabeledField';
import { AUTHORS_SEPARATOR_HINT } from '../common/articleFieldHints';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
import { useDialogs } from '../common/dialogs/DialogProvider';
import {
  articleFromForm,
  fieldsFromArticle,
  fillEmptyFields,
  TITLE_REQUIRED,
  type ArticleFormFields,
} from './articleForm/articleFormData';

interface EditArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article;
  onSubmit: (data: Partial<Article>) => Promise<void>;
}

// Mounted per opening and per article (key), so the form always starts from the article it edits.
const EditArticleForm: React.FC<Omit<EditArticleModalProps, 'isOpen'>> = ({ onClose, article, onSubmit }) => {
  const projectService = useProjectService();
  const { showError } = useGlobalError();
  const { inform } = useDialogs();
  const [fields, setFields] = useState<ArticleFormFields>(() => fieldsFromArticle(article));
  const [submitting, setSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const set = (key: keyof ArticleFormFields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.title.trim()) return void inform({ title: 'Editar artigo', message: TITLE_REQUIRED });
    setSubmitting(true);
    try {
      await onSubmit(articleFromForm(fields));
      onClose();
    } catch (err: unknown) {
      await inform(failureNotice('Não conseguimos salvar a edição', 'As alterações não foram salvas.', err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtractWithAI = async () => {
    if (!article.local_file_path) return;
    setIsExtracting(true);
    try {
      const data = await projectService.extractMetadata(article.id);
      if (data) setFields((f) => fillEmptyFields(f, data));
    } catch (err: unknown) {
      // Typed, user-actionable errors (e.g. missing API key) get the global error modal.
      const appError = err as Partial<FrontendAppError> | null;
      if (appError?.isAppError && appError.code !== 'ERR_INTERNAL') showError(err);
      else await inform(failureNotice('Não conseguimos extrair os metadados', 'A IA não conseguiu ler o artigo.', err));
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Modal label="Editar metadados" title="Editar metadados" onClose={onClose} busy={submitting} width={550}>
      {article.local_file_path && (
        <button
          type="button"
          onClick={handleExtractWithAI}
          disabled={isExtracting}
          className="btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            alignSelf: 'flex-start',
          }}
        >
          {isExtracting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
          )}
          Preencher com IA
        </button>
      )}

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && e.currentTarget.requestSubmit()}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <span className="app-modal-group">Identificação</span>
        <LabeledField label="Título *" value={fields.title} onChange={set('title')} required />
        <LabeledField label="Autores" value={fields.authors} onChange={set('authors')} hint={AUTHORS_SEPARATOR_HINT} />
        <span className="app-modal-group">Publicação</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <LabeledField label="Revista / Periódico" value={fields.journal} onChange={set('journal')} />
          <LabeledField label="Ano" type="number" value={fields.year} onChange={set('year')} />
        </div>
        <LabeledField label="DOI" value={fields.doi} onChange={set('doi')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <LabeledField label="Volume" value={fields.volume} onChange={set('volume')} />
          <LabeledField label="Edição (Issue)" value={fields.issue} onChange={set('issue')} />
          <LabeledField label="Páginas" value={fields.pages} onChange={set('pages')} />
        </div>
        <LabeledField label="Resumo" value={fields.abstract} onChange={set('abstract')} multiline reading />

        <ModalFooter hint={<span className="app-modal-kbd">Ctrl Enter</span>}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} aria-hidden="true" />}
            Salvar
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

/**
 * Edits an article's metadata; "Preencher com IA" reads the attached PDF and fills only the empty fields.
 * Opened fresh for each article (the callers mount it while editing), so the form starts from that article.
 *
 * @example {editing && <EditArticleModal isOpen article={editing} onClose={close} onSubmit={save} />}
 */
export const EditArticleModal: React.FC<EditArticleModalProps> = ({ isOpen, ...props }) =>
  isOpen ? <EditArticleForm key={props.article.id} {...props} /> : null;
