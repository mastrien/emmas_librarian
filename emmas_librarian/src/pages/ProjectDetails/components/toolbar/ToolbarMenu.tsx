import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface ToolbarMenuItem {
  icon: React.ReactNode;
  label: React.ReactNode;
  onSelect: () => void;
}

interface ToolbarMenuProps {
  /** The button's look: the add menu is the page's other primary action, the export menu is secondary. */
  variant: 'primary' | 'secondary';
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ToolbarMenuItem[];
  menuRef: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * A toolbar button that opens a list of actions below it ("Adicionar Artigos", "Exportar"). Choosing one closes the
 * list first. Hover and outside clicks are handled by the page, which owns `open`.
 *
 * The props are destructured: with the ref inside a props object, react-hooks/refs flags every read of that object
 * during render.
 *
 * @example <ToolbarMenu variant="secondary" icon={<Download size={18} />} label="Exportar" open={o} items={items} … />
 */
export const ToolbarMenu: React.FC<ToolbarMenuProps> = ({
  variant,
  icon,
  label,
  open,
  onOpenChange,
  items,
  menuRef,
  onMouseEnter,
  onMouseLeave,
}) => (
  <div ref={menuRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className="toolbar-menu">
    <button onClick={() => onOpenChange(!open)} className={`btn-${variant} toolbar-button`}>
      {icon} {label} <ChevronDown size={14} />
    </button>
    {open && (
      <div className="glass-panel toolbar-menu-list">
        {items.map((item, i) => (
          <button
            key={i}
            className="menu-dropdown-item"
            onClick={() => {
              onOpenChange(false);
              item.onSelect();
            }}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>
    )}
  </div>
);
