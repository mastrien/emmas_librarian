import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Globe, Loader2, Upload } from 'lucide-react';
import type { Article } from '../../../../types';
import { ArticleRowMenu, type RowMenuGroup } from './ArticleRowMenu';
import type { ArticleRowHandlers } from './ArticleRowActions';

const ICON = 16;

/** A file with a diagonal slash: "no PDF yet" (decision on the redesign canvas, board 153). */
export const NoPdfIcon: React.FC = () => (
  <svg
    width={ICON}
    height={ICON}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M3 3l18 18" />
  </svg>
);

// "Vincular PDF" offers the two ways to get the PDF: a file from the computer, or an open access copy.
const attachGroups = (article: Article, h: ArticleRowHandlers): RowMenuGroup[] => [
  {
    label: 'Vincular PDF',
    items: [
      { label: 'Do computador…', icon: <Upload size={15} />, onSelect: () => h.onUpload(article.id) },
      { label: 'Buscar PDF aberto', icon: <Globe size={15} />, onSelect: () => h.onFindOpenAccess(article.id) },
    ],
  },
];

const AttachPdf: React.FC<{ article: Article; handlers: ArticleRowHandlers }> = ({ article, handlers }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  return (
    <>
      <button
        type="button"
        className="row-icon-button row-icon-button--muted"
        aria-label="Vincular PDF"
        title="Sem PDF: vincular um"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <NoPdfIcon />
      </button>
      {anchor && <ArticleRowMenu anchor={anchor} groups={attachGroups(article, handlers)} onClose={close} />}
    </>
  );
};

/**
 * The PDF column: open the PDF in the reader, or (no PDF yet) link one from the computer or an open access copy;
 * a spinner while that copy is searched for.
 *
 * @example <PdfCell article={article} handlers={rowHandlers} searching={false} />
 */
export const PdfCell: React.FC<{ article: Article; handlers: ArticleRowHandlers; searching: boolean }> = ({
  article,
  handlers,
  searching,
}) => {
  if (searching) {
    return (
      <span className="row-icon-button" role="status" aria-label="Buscando PDF…" title="Buscando PDF…">
        <Loader2 size={ICON} className="animate-spin" aria-hidden="true" />
      </span>
    );
  }
  if (!article.local_file_path) return <AttachPdf article={article} handlers={handlers} />;
  return (
    <Link
      to={`/articles/${article.id}`}
      className="row-icon-button row-icon-button--accent"
      aria-label="Ler"
      title="Ler o PDF"
    >
      <FileText size={ICON} aria-hidden="true" />
    </Link>
  );
};
