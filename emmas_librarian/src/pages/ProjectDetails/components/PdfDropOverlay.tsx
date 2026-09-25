import React from 'react';
import { createPortal } from 'react-dom';
import { CopyPlus } from 'lucide-react';

/**
 * Full-screen hint shown while PDFs are dragged over the project page. It ignores pointer
 * events so the drop still lands on the page underneath.
 *
 * Usage:
 *   {isDragging && <PdfDropOverlay />}
 */
export const PdfDropOverlay: React.FC = () =>
  createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '4px dashed var(--color-primary)',
        pointerEvents: 'none',
      }}
    >
      <h2 style={{ color: 'white', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <CopyPlus size={40} /> Solte seus PDFs aqui para importar
      </h2>
    </div>,
    document.body,
  );
