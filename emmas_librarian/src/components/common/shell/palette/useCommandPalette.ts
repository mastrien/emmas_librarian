import { useCallback, useState } from 'react';
import { useCommandPaletteShortcut } from './useCommandPaletteShortcut';

export interface CommandPaletteState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Whether the palette is open, with Ctrl+K wired to open it.
 *
 * @example const palette = useCommandPalette(); {palette.isOpen && <CommandPalette onClose={palette.close} />}
 */
export function useCommandPalette(): CommandPaletteState {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  useCommandPaletteShortcut(open);
  return { isOpen, open, close };
}
