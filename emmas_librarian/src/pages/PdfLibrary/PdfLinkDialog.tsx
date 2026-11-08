import React from 'react';
import { Info } from 'lucide-react';
import type { Article, Project } from '../../types';
import type { PdfFileRecord } from './pdfLibraryData';
import { Modal } from '../../components/common/Modal';
import { SelectField } from '../../components/common/fields';

export interface PdfLinkDialogProps {
  pdf: PdfFileRecord;
  projects: Project[];
  projectId: number | '';
  onProjectChange: (projectId: number) => void;
  articles: Article[];
  articleId: number | '';
  onArticleChange: (articleId: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const ArticlePicker: React.FC<Pick<PdfLinkDialogProps, 'articles' | 'articleId' | 'onArticleChange'>> = (props) => {
  if (props.articles.length === 0) {
    return (
      <div className="pdf-link-none">
        <Info size={14} /> Nenhum artigo sem PDF neste projeto.
      </div>
    );
  }
  return (
    <SelectField
      label="Artigo (apenas sem PDF)"
      value={String(props.articleId)}
      onChange={(e) => props.onArticleChange(Number(e.target.value))}
      options={[
        { value: '', label: '-- Selecione um Artigo --' },
        ...props.articles.map((a) => ({ value: String(a.id), label: a.title })),
      ]}
    />
  );
};

/**
 * Links a stored PDF to an article without one: pick the project, then the article. Built on the shared Modal
 * (Arca 134): closes with its X or Esc, scrolls when tall.
 *
 * @example <PdfLinkDialog pdf={pdf} projects={projects} projectId={p} onProjectChange={pick} … />
 */
export const PdfLinkDialog: React.FC<PdfLinkDialogProps> = (props) => (
  <Modal
    label="Vincular PDF a um Artigo"
    title="Vincular PDF a um Artigo"
    description={
      <>
        Selecione o projeto e o artigo correspondente para vincular o PDF: <strong>{props.pdf.filename}</strong>
      </>
    }
    onClose={props.onCancel}
    width={500}
  >
    <div className="pdf-link-fields">
      <SelectField
        label="Projeto"
        value={String(props.projectId)}
        onChange={(e) => props.onProjectChange(Number(e.target.value))}
        options={[
          { value: '', label: '-- Selecione um Projeto --' },
          ...props.projects.map((p) => ({ value: String(p.id), label: p.name })),
        ]}
      />
      {props.projectId !== '' && <ArticlePicker {...props} />}
    </div>
    <div className="pdf-link-actions">
      <button className="btn-secondary" onClick={props.onCancel}>
        Cancelar
      </button>
      <button className="btn-primary" onClick={props.onConfirm} disabled={!props.articleId}>
        Vincular PDF
      </button>
    </div>
  </Modal>
);
