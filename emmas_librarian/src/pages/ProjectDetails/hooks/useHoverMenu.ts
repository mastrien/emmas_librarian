import { useCallback, useEffect, useRef, useState } from 'react';

export interface HoverMenu {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  ref: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Dropdown that opens on hover, closes shortly after the pointer leaves (so moving
 * into the panel does not close it) and closes on any click outside its container.
 *
 * Usage:
 *   const menu = useHoverMenu();
 *   <div ref={menu.ref} onMouseEnter={menu.onMouseEnter} onMouseLeave={menu.onMouseLeave}>...</div>
 */
export function useHoverMenu(closeDelayMs = 200): HoverMenu {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const onMouseEnter = useCallback(() => {
    cancelClose();
    setIsOpen(true);
  }, [cancelClose]);

  const onMouseLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setIsOpen(false), closeDelayMs);
  }, [closeDelayMs]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      cancelClose();
    };
  }, [cancelClose]);

  return { isOpen, setIsOpen, ref, onMouseEnter, onMouseLeave };
}
