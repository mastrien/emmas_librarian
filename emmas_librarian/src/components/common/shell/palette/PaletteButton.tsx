import React from 'react';
import { Search } from 'lucide-react';
import './palette.css';

/**
 * The title bar's search: only a button at the right end (lupa + Ctrl K), so the path keeps the width
 * (decision on the redesign canvas, board 150).
 *
 * @example <PaletteButton onOpen={() => setPaletteOpen(true)} />
 */
export const PaletteButton: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <button
    type="button"
    className="palette-button"
    onClick={onOpen}
    aria-label="Ir para, buscar artigo, executar (Ctrl+K)"
    aria-keyshortcuts="Control+K"
    title="Ir para, buscar artigo, executar"
  >
    <Search size={14} aria-hidden="true" />
    <kbd>Ctrl K</kbd>
  </button>
);
