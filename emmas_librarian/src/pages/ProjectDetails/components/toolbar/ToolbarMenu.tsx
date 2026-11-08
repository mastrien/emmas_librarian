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
 * @example <ToolbarMenu variant="secondary" icon={<Download size={18} />} label="Exportar" open={o} items={items} … />
 */
export const ToolbarMenu: React.FC<ToolbarMenuProps> = (props) => (
  <div ref={props.menuRef} onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave} className="toolbar-menu">
    <button onClick={() => props.onOpenChange(!props.open)} className={`btn-${props.variant} toolbar-button`}>
      {props.icon} {props.label} <ChevronDown size={14} />
    </button>
    {props.open && (
      <div className="glass-panel toolbar-menu-list">
        {props.items.map((item, i) => (
          <button
            key={i}
            className="menu-dropdown-item"
            onClick={() => {
              props.onOpenChange(false);
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
