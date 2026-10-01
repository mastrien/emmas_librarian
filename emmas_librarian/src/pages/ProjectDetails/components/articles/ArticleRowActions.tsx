import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  CheckCircle,
  CopyPlus,
  Edit2,
  ExternalLink,
  FileText,
  Globe,
  History,
  Loader2,
  MoreHorizontal,
  Upload,
  X,
} from 'lucide-react';
import type { Article } from '../../../../types';
import { ArticleRowMenu, type RowMenuGroup } from './ArticleRowMenu';
import { openAccessMessage, type OpenAccessRowState } from './openAccessText';

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
}

interface ToggleAction {
  label: string;
  title: string;
  icon: React.ReactNode;
  run: () => void;
  danger?: boolean;
}

const ICON = 15;

// Read/unread and archive/restore: shown as hover shortcuts and again in the menu.
function statusActions(article: Article, h: ArticleRowHandlers): ToggleAction[] {
  const read: ToggleAction =
    article.status === 'read'
      ? {
          label: 'Desmarcar',
          title: 'Desmarcar como Lido',
          icon: <CheckCircle size={ICON} />,
          run: () => h.onStatusChange(article.id, 'new'),
        }
      : {
          label: 'Lido',
          title: 'Marcar como Lido',
          icon: <CheckCircle size={ICON} />,
          run: () => h.onStatusChange(article.id, 'read'),
        };
  const archive: ToggleAction =
    article.status === 'archived'
      ? {
          label: 'Restaurar',
          title: 'Restaurar Artigo',
          icon: <History size={ICON} />,
          run: () => h.onStatusChange(article.id, 'new'),
        }
      : {
          label: 'Arquivar',
          title: 'Arquivar',
          icon: <Archive size={ICON} />,
          run: () => h.onArchive(article.id),
          danger: true,
        };
  return article.status === 'archived' ? [archive] : [read, archive];
}

function menuGroups(article: Article, h: ArticleRowHandlers): RowMenuGroup[] {
  const groups: RowMenuGroup[] = [];
  if (article.local_file_path) {
    groups.push({
      label: 'Leitura',
      items: [
        { label: 'Desvincular PDF', icon: <X size={ICON} />, onSelect: () => h.onUnlink(article.id), danger: true },
      ],
    });
  }
  groups.push({
    label: 'Organização',
    items: statusActions(article, h).map((a) => ({ label: a.title, icon: a.icon, onSelect: a.run, danger: a.danger })),
  });
  groups.push({
    label: 'Referência',
    items: [
      { label: 'Editar Metadados', icon: <Edit2 size={ICON} />, onSelect: () => h.onEdit(article) },
      { label: 'Gerar Citação', icon: <CopyPlus size={ICON} />, onSelect: () => h.onCite(article) },
    ],
  });
  return groups;
}

// "Vincular PDF" offers the two ways to get the PDF: a file from the computer, or an open access copy.
const attachGroups = (article: Article, h: ArticleRowHandlers): RowMenuGroup[] => [
  {
    label: 'Vincular PDF',
    items: [
      { label: 'Do computador…', icon: <Upload size={ICON} />, onSelect: () => h.onUpload(article.id) },
      { label: 'Buscar PDF aberto', icon: <Globe size={ICON} />, onSelect: () => h.onFindOpenAccess(article.id) },
    ],
  },
];

const AttachPdf: React.FC<{ article: Article; handlers: ArticleRowHandlers; searching: boolean }> = ({
  article,
  handlers,
  searching,
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  if (searching) {
    return (
      <button type="button" className="btn-ghost" disabled>
        <Loader2 size={ICON} className="animate-spin" /> Buscando PDF…
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <Upload size={ICON} /> Vincular PDF
      </button>
      {anchor && <ArticleRowMenu anchor={anchor} groups={attachGroups(article, handlers)} onClose={close} />}
    </>
  );
};

const OpenAccessStatus: React.FC<{ state?: OpenAccessRowState }> = ({ state }) => {
  if (!state || state.status === 'running') return null;
  const message = openAccessMessage(state);
  return (
    <div className={`row-actions__line row-actions__oa row-actions__oa--${message.tone}`} role="status">
      {message.text}
      {message.page && (
        <a href={message.page} target="_blank" rel="noreferrer">
          Abrir a página
        </a>
      )}
    </div>
  );
};

const DoiButton: React.FC<{ doi?: string }> = ({ doi }) =>
  doi ? (
    <a
      href={`https://doi.org/${doi}`}
      target="_blank"
      rel="noreferrer"
      className="btn-ghost"
      title="Abrir pelo DOI no navegador"
    >
      <ExternalLink size={ICON} /> <span className="label-when-wide">DOI</span>
    </a>
  ) : null;

const Shortcuts: React.FC<{ actions: ToggleAction[] }> = ({ actions }) => (
  <div className="row-actions__line row-actions__shortcuts" role="toolbar" aria-label="Atalhos">
    {actions.map((a) => (
      <button
        key={a.title}
        type="button"
        className={`btn-ghost${a.danger ? ' btn-ghost--danger' : ''}`}
        onClick={a.run}
        title={a.title}
      >
        {a.icon} {a.label}
      </button>
    ))}
  </div>
);

/**
 * Actions of one row in the project's article table: DOI, read/attach PDF and a "⋯" menu with everything
 * else; "Lido" and "Arquivar" also appear as shortcuts on a second line while the row is hovered or focused.
 *
 * @example <ArticleRowActions article={article} handlers={rowHandlers} />
 */
export const ArticleRowActions: React.FC<{
  article: Article;
  handlers: ArticleRowHandlers;
  openAccess?: OpenAccessRowState;
}> = ({ article, handlers, openAccess }) => {
  // The "⋯" button the menu is anchored to; null while the menu is closed.
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  return (
    <div className="row-actions">
      <div className="row-actions__line">
        <span className="row-actions__slot-doi">
          <DoiButton doi={article.doi} />
        </span>
        <span className="row-actions__slot-primary">
          {article.local_file_path ? (
            <Link to={`/articles/${article.id}`} className="btn-ghost btn-ghost--accent">
              <FileText size={ICON} /> Ler
            </Link>
          ) : (
            <AttachPdf article={article} handlers={handlers} searching={openAccess?.status === 'running'} />
          )}
        </span>
        <button
          type="button"
          className="btn-ghost btn-ghost--icon"
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
      </div>
      <OpenAccessStatus state={openAccess} />
      <Shortcuts actions={statusActions(article, handlers)} />
      {menuAnchor && <ArticleRowMenu anchor={menuAnchor} groups={menuGroups(article, handlers)} onClose={closeMenu} />}
    </div>
  );
};
