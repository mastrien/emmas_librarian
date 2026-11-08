import React from 'react';
import { createPortal } from 'react-dom';
import { CopyPlus } from 'lucide-react';
import '../projectPage.css';

/**
 * Full-screen hint shown while PDFs are dragged over the project page. It ignores pointer
 * events so the drop still lands on the page underneath.
 *
 * Usage:
 *   {isDragging && <PdfDropOverlay />}
 */
export const PdfDropOverlay: React.FC = () =>
  createPortal(
    <div className="pdf-drop-overlay">
      <h2>
        <CopyPlus size={40} /> Solte seus PDFs aqui para importar
      </h2>
    </div>,
    document.body,
  );
