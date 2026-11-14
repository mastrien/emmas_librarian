import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ArticleRowMenu, type RowMenuItem } from '../../pages/ProjectDetails/components/articles/ArticleRowMenu';

interface RowActionsButtonProps {
  /** The button's name for screen readers: what the menu is of ("Ações de Técnica mencionada"). */
  label: string;
  items: RowMenuItem[];
}

/**
 * The "⋯" at the end of a line (board 178): a ghost button that opens the line's actions as a menu.
 *
 * @example <RowActionsButton label="Ações de Período" items={[{ label: 'Editar', icon: <Pencil size={14} />, onSelect: edit }]} />
 */
export const RowActionsButton: React.FC<RowActionsButtonProps> = ({ label, items }) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className="btn-ghost btn-ghost--icon"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && anchor && (
        <ArticleRowMenu anchor={anchor} groups={[{ label, items, quiet: true }]} onClose={() => setOpen(false)} />
      )}
    </>
  );
};
