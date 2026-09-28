import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  CheckCircle,
  CopyPlus,
  Edit2,
  ExternalLink,
  FileText,
  History,
  MoreHorizontal,
  Upload,
  X,
} from 'lucide-react';
import type { Article } from '../../../../types';
import { ArticleRowMenu, type RowMenuGroup } from './ArticleRowMenu';

type ArticleStatus = 'new' | 'read' | 'archived';

export interface ArticleRowHandlers {
  onUpload: (id: number) => void;
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

const MainAction: React.FC<{ article: Article; onUpload: (id: number) => void }> = ({ article, onUpload }) =>
  article.local_file_path ? (
    <Link to={`/articles/${article.id}`} className="btn-ghost btn-ghost--accent">
      <FileText size={ICON} /> Ler
    </Link>
  ) : (
    <button type="button" className="btn-ghost" onClick={() => onUpload(article.id)} title="Vincular PDF">
      <Upload size={ICON} /> Vincular PDF
    </button>
  );

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
export const ArticleRowActions: React.FC<{ article: Article; handlers: ArticleRowHandlers }> = ({
  article,
  handlers,
}) => {
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
          <MainAction article={article} onUpload={handlers.onUpload} />
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
      <Shortcuts actions={statusActions(article, handlers)} />
      {menuAnchor && <ArticleRowMenu anchor={menuAnchor} groups={menuGroups(article, handlers)} onClose={closeMenu} />}
    </div>
  );
};
