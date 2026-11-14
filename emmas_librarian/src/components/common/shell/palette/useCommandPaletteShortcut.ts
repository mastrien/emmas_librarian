import { useEffect } from 'react';

/**
 * Ctrl+K (Cmd+K on macOS) opens the palette from anywhere, even with the focus in a text field.
 *
 * @example useCommandPaletteShortcut(() => setPaletteOpen(true));
 */
export function useCommandPaletteShortcut(onOpen: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      event.preventDefault();
      onOpen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);
}
