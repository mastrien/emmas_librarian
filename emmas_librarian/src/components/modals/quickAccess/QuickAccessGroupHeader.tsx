import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import './quickAccess.css';

interface QuickAccessGroupHeaderProps {
  name: string;
  /** Gets the new name when it was typed and confirmed with Enter. */
  onRename: (name: string) => void;
}

/**
 * A group's name in the quick access window, with a pencil that turns it into a field (board 178). Enter renames the
 * group, Esc and leaving the field keep the old name.
 *
 * @example <QuickAccessGroupHeader name="Reuniões" onRename={(next) => renameGroup('Reuniões', next)} />
 */
export const QuickAccessGroupHeader: React.FC<QuickAccessGroupHeaderProps> = ({ name, onRename }) => {
  const [typed, setTyped] = useState<string | null>(null);

  const finish = (confirmed: boolean) => {
    const next = typed?.trim();
    setTyped(null);
    if (confirmed && next && next !== name) onRename(next);
  };

  if (typed !== null) {
    return (
      <input
        autoFocus
        className="input-field quick-access-group__input"
        aria-label={`Novo nome do grupo ${name}`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={() => finish(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true);
          if (e.key === 'Escape') {
            e.stopPropagation();
            finish(false);
          }
        }}
      />
    );
  }
  return (
    <div className="quick-access-group__head">
      <span className="quick-access-group__name">{name}</span>
      <button
        type="button"
        className="btn-ghost btn-ghost--icon"
        aria-label={`Renomear grupo ${name}`}
        title="Renomear grupo"
        onClick={() => setTyped(name)}
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
    </div>
  );
};
