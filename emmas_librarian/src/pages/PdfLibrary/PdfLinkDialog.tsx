import React from 'react';
import { Info } from 'lucide-react';
import type { Article, Project } from '../../types';
import type { PdfFileRecord } from './pdfLibraryData';

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

const ArticlePicker: React.FC<Pick<PdfLinkDialogProps, 'articles' | 'articleId' | 'onArticleChange'>> = (props) => (
  <div className="pdf-link-field">
    <label>ARTIGO (APENAS SEM PDF)</label>
    {props.articles.length === 0 ? (
      <div className="pdf-link-none">
        <Info size={14} /> Nenhum artigo sem PDF neste projeto.
      </div>
    ) : (
      <select
        className="input-field"
        value={props.articleId}
        onChange={(e) => props.onArticleChange(Number(e.target.value))}
      >
        <option value="">-- Selecione um Artigo --</option>
        {props.articles.map((a) => (
          <option key={a.id} value={a.id}>
            {a.title}
          </option>
        ))}
      </select>
    )}
  </div>
);

/**
 * Links a stored PDF to an article without one: pick the project, then the article. Still its own overlay; it moves
 * to the shared Modal in a separate change (Arca 134).
 *
 * @example <PdfLinkDialog pdf={pdf} projects={projects} projectId={p} onProjectChange={pick} … />
 */
export const PdfLinkDialog: React.FC<PdfLinkDialogProps> = (props) => (
  <div role="dialog" aria-modal="true" aria-label="Vincular PDF a um Artigo" className="pdf-link-overlay">
    <div className="card fade-in pdf-link-window">
      <h3>Vincular PDF a um Artigo</h3>
      <p className="pdf-link-intro">
        Selecione o projeto e o artigo correspondente para vincular o PDF: <strong>{props.pdf.filename}</strong>
      </p>
      <div className="pdf-link-fields">
        <div className="pdf-link-field">
          <label>PROJETO</label>
          <select
            className="input-field"
            value={props.projectId}
            onChange={(e) => props.onProjectChange(Number(e.target.value))}
          >
            <option value="">-- Selecione um Projeto --</option>
            {props.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
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
    </div>
  </div>
);
