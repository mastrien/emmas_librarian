import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Link2, MoreHorizontal, Trash2 } from 'lucide-react';
import { useCloseOnOutside } from '../SystematicReview/LabelMenu';
import { formatAddedDay, type PdfFileRecord } from './pdfLibraryData';
import { formatBytes } from '../../utils/formatters';

interface PdfRowActions {
  onLink: (pdf: PdfFileRecord) => void;
  onDelete: (pdf: PdfFileRecord) => void;
}

const PdfUses: React.FC<{ pdf: PdfFileRecord }> = ({ pdf }) => {
  const navigate = useNavigate();
  if (pdf.articles.length === 0) {
    return (
      <span className="pdf-orphan">
        <AlertTriangle size={12} /> Órfão (Nenhum vínculo)
      </span>
    );
  }
  return (
    <div className="pdf-uses">
      <span className="pdf-uses-count">
        {pdf.articles.length === 1 ? 'Utilizado em 1 artigo' : `Utilizado em ${pdf.articles.length} artigos`}
      </span>
      {pdf.articles.map((art) => (
        <div key={art.article_id} className="pdf-use">
          <span
            className="pdf-use-article"
            onClick={() => navigate(`/articles/${art.article_id}`)}
            title={art.article_title}
          >
            {art.article_title} <ExternalLink size={10} />
          </span>
          <span
            className="pdf-use-project"
            onClick={() => navigate(`/projects/${art.project_id}`)}
            title={art.project_name}
          >
            Projeto: <strong>{art.project_name}</strong>
          </span>
        </div>
      ))}
    </div>
  );
};

/** "Mais ações" (board 171): linking the PDF to another article and deleting it, out of the way of "Abrir". */
const RowMenu: React.FC<{ pdf: PdfFileRecord } & PdfRowActions> = ({ pdf, onLink, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const pick = (action: (pdf: PdfFileRecord) => void) => () => {
    setOpen(false);
    action(pdf);
  };
  return (
    <div className="pdf-menu" ref={ref}>
      <button
        type="button"
        className="pdf-menu__button"
        aria-label="Mais ações"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="pdf-menu__list" role="menu" aria-label="Ações do PDF">
          <button type="button" role="menuitem" title="Vincular a outro Artigo" onClick={pick(onLink)}>
            <Link2 size={14} aria-hidden="true" /> Vincular a outro artigo
          </button>
          <button type="button" role="menuitem" className="is-danger" title="Excluir PDF" onClick={pick(onDelete)}>
            <Trash2 size={14} aria-hidden="true" /> Excluir PDF
          </button>
        </div>
      )}
    </div>
  );
};

const PdfActions: React.FC<{ pdf: PdfFileRecord } & PdfRowActions> = ({ pdf, ...actions }) => {
  const navigate = useNavigate();
  return (
    <div className="pdf-actions">
      {pdf.articles.length > 0 && (
        <button
          type="button"
          className="pdf-open"
          onClick={() => navigate(`/articles/${pdf.articles[0].article_id}`)}
          title="Visualizar no Leitor"
        >
          Abrir
        </button>
      )}
      <RowMenu pdf={pdf} {...actions} />
    </div>
  );
};

// The added date is the third column: the screenshot comparison masks it by position (visual-tests).
const PdfRow: React.FC<{ pdf: PdfFileRecord } & PdfRowActions> = ({ pdf, ...actions }) => (
  <tr>
    <td className="pdf-cell-file">
      <span title={pdf.filename}>{pdf.filename}</span>
    </td>
    <td className="pdf-cell-size">{formatBytes(pdf.file_size)}</td>
    <td className="pdf-cell-date">{formatAddedDay(pdf.created_at)}</td>
    <td className="pdf-cell-links">
      <PdfUses pdf={pdf} />
    </td>
    <td className="pdf-cell-actions">
      <PdfActions pdf={pdf} {...actions} />
    </td>
  </tr>
);

/**
 * The library's table: each stored PDF with its size, when it was added, the articles using it and its actions.
 *
 * @example <PdfTable pdfs={filterPdfs(pdfs, search)} onLink={openLink} onDelete={remove} />
 */
export const PdfTable: React.FC<{ pdfs: PdfFileRecord[] } & PdfRowActions> = ({ pdfs, ...actions }) => (
  <div className="pdf-table-wrap">
    {pdfs.length === 0 ? (
      <div className="pdf-table-empty">Nenhum arquivo PDF encontrado.</div>
    ) : (
      <table className="table pdf-table">
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Tamanho</th>
            <th>Adicionado</th>
            <th>Artigo vinculado</th>
            <th aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {pdfs.map((pdf) => (
            <PdfRow key={pdf.file_path} pdf={pdf} {...actions} />
          ))}
        </tbody>
      </table>
    )}
  </div>
);
