import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface RowMenuItem {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

export interface RowMenuGroup {
  label: string;
  items: RowMenuItem[];
}

interface ArticleRowMenuProps {
  anchor: HTMLElement;
  groups: RowMenuGroup[];
  onClose: () => void;
}

const EDGE = 8;
// The click that opens the menu can scroll the page to bring the button into view; ignore that scroll.
const SCROLL_GRACE_MS = 250;

// Below the button, right-aligned to it; above when there is no room below.
function menuPosition(anchor: HTMLElement, menu: HTMLElement): { top: number; left: number } {
  const r = anchor.getBoundingClientRect();
  const left = Math.max(EDGE, Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - EDGE));
  const below = r.bottom + 6;
  const fitsBelow = below + menu.offsetHeight <= window.innerHeight - EDGE;
  return { top: fitsBelow ? below : Math.max(EDGE, r.top - menu.offsetHeight - 6), left };
}

function focusSibling(menu: HTMLElement, step: number): void {
  const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  items[(current + step + items.length) % items.length]?.focus();
}

function useCloseTriggers(menuRef: React.RefObject<HTMLDivElement | null>, anchor: HTMLElement, close: () => void) {
  useEffect(() => {
    const openedAt = performance.now();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !anchor.contains(target)) close();
    };
    const onScroll = () => performance.now() - openedAt > SCROLL_GRACE_MS && close();
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [menuRef, anchor, close]);
}

/**
 * Dropdown of an article row's secondary actions. Rendered in a portal with fixed position, because the
 * articles table scrolls horizontally and would clip it. Esc and choosing an item return focus to the button.
 *
 * @example {menuOpen && <ArticleRowMenu anchor={buttonEl} groups={groups} onClose={() => setMenuOpen(false)} />}
 */
export const ArticleRowMenu: React.FC<ArticleRowMenuProps> = ({ anchor, groups, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useCloseTriggers(menuRef, anchor, onClose);

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    setPosition(menuPosition(anchor, menuRef.current));
    menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [anchor]);

  const closeAndFocus = () => {
    onClose();
    anchor.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeAndFocus();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusSibling(e.currentTarget as HTMLElement, e.key === 'ArrowDown' ? 1 : -1);
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="row-menu"
      onKeyDown={onKeyDown}
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
    >
      {groups.map((group) => (
        <div key={group.label} className="row-menu__group" role="group" aria-label={group.label}>
          <div className="row-menu__label" aria-hidden="true">
            {group.label}
          </div>
          {group.items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`row-menu__item${item.danger ? ' row-menu__item--danger' : ''}`}
              onClick={() => {
                closeAndFocus();
                item.onSelect();
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
};
