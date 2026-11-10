import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  CheckCircle,
  CopyPlus,
  Edit2,
  ExternalLink,
  FileText,
  History,
  MoreHorizontal,
  Network,
  X,
} from 'lucide-react';
import type { Article } from '../../../../types';
import { ArticleRowMenu, type RowMenuGroup, type RowMenuItem } from './ArticleRowMenu';

type ArticleStatus = 'new' | 'read' | 'archived';

export interface ArticleRowHandlers {
  onUpload: (id: number) => void;
  /** Looks for an open access copy of the article's PDF and links it. */
  onFindOpenAccess: (id: number) => void;
  onUnlink: (id: number) => void;
  onStatusChange: (id: number, status: ArticleStatus) => void;
  onEdit: (article: Article) => void;
  onArchive: (id: number) => void;
  onCite: (article: Article) => void;
  onExploreCitations: (article: Article) => void;
}

const ICON = 15;

// Read/unread and archive/restore, first in the menu: the row no longer has hover shortcuts (board 153).
function statusItems(article: Article, h: ArticleRowHandlers): RowMenuItem[] {
  const read: RowMenuItem =
    article.status === 'read'
      ? {
          label: 'Desmarcar como Lido',
          icon: <CheckCircle size={ICON} />,
          onSelect: () => h.onStatusChange(article.id, 'new'),
        }
      : {
          label: 'Marcar como Lido',
          icon: <CheckCircle size={ICON} />,
          onSelect: () => h.onStatusChange(article.id, 'read'),
        };
  if (article.status === 'archived') {
    return [
      { label: 'Restaurar Artigo', icon: <History size={ICON} />, onSelect: () => h.onStatusChange(article.id, 'new') },
    ];
  }
  return [
    read,
    { label: 'Arquivar', icon: <Archive size={ICON} />, onSelect: () => h.onArchive(article.id), danger: true },
  ];
}

function readingItems(article: Article, h: ArticleRowHandlers, openReader: () => void): RowMenuItem[] {
  const items: RowMenuItem[] = [];
  if (article.local_file_path) items.push({ label: 'Ler o PDF', icon: <FileText size={ICON} />, onSelect: openReader });
  if (article.doi) {
    const url = `https://doi.org/${article.doi}`;
    items.push({
      label: 'Abrir pelo DOI',
      icon: <ExternalLink size={ICON} />,
      onSelect: () => window.open(url, '_blank'),
    });
  }
  if (article.local_file_path) {
    items.push({
      label: 'Desvincular PDF',
      icon: <X size={ICON} />,
      onSelect: () => h.onUnlink(article.id),
      danger: true,
    });
  }
  return items;
}

function menuGroups(article: Article, h: ArticleRowHandlers, openReader: () => void): RowMenuGroup[] {
  const reading = readingItems(article, h, openReader);
  return [
    { label: 'Organização', items: statusItems(article, h) },
    ...(reading.length ? [{ label: 'Leitura', items: reading }] : []),
    {
      label: 'Referência',
      items: [
        { label: 'Editar Metadados', icon: <Edit2 size={ICON} />, onSelect: () => h.onEdit(article) },
        { label: 'Gerar Citação', icon: <CopyPlus size={ICON} />, onSelect: () => h.onCite(article) },
        { label: 'Explorar citações', icon: <Network size={ICON} />, onSelect: () => h.onExploreCitations(article) },
      ],
    },
  ];
}

// There is no delete button: an article from outside the searches leaves with its history entry (#67).
const UNDO_HINT = 'se quiser excluir este artigo, desfaça a inclusão dele no histórico';

/**
 * The row's "⋯" (board 153): status first (Lido, Arquivar or Restaurar), then reading (PDF, DOI), then the
 * reference tools. For an article from outside the searches the menu ends with how to remove it.
 *
 * @example <ArticleRowActions article={article} handlers={rowHandlers} />
 */
export const ArticleRowActions: React.FC<{
  article: Article;
  handlers: ArticleRowHandlers;
  /** The article came from outside the structured searches (added by hand, a PDF batch, another project). */
  outsideSearch?: boolean;
}> = ({ article, handlers, outsideSearch = false }) => {
  const navigate = useNavigate();
  // The "⋯" button the menu is anchored to; null while the menu is closed.
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const closeMenu = useCallback(() => setMenuAnchor(null), []);
  return (
    <>
      <button
        type="button"
        className="row-icon-button row-actions-trigger"
        aria-label="Mais ações"
        title="Mais ações"
        aria-haspopup="menu"
        aria-expanded={menuAnchor !== null}
        onClick={(e) => {
          const button = e.currentTarget;
          setMenuAnchor((open) => (open ? null : button));
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {menuAnchor && (
        <ArticleRowMenu
          anchor={menuAnchor}
          groups={menuGroups(article, handlers, () => navigate(`/articles/${article.id}`))}
          onClose={closeMenu}
          footnote={outsideSearch ? UNDO_HINT : undefined}
        />
      )}
    </>
  );
};
