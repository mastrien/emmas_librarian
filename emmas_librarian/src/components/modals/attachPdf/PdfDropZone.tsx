import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { droppedFilePath } from '../../../utils/droppedFilePath';
import './attachPdf.css';

interface PdfDropZoneProps {
  /** Gets the disk path of the PDF dropped here. */
  onPick: (filePath: string) => void;
  /** The "choose a file" link: the native file dialog. */
  onChoose: () => void;
  /** A dropped file that is not a PDF. */
  onRejected: () => void;
  disabled?: boolean;
}

const isPdf = (file: File): boolean => file.name.toLowerCase().endsWith('.pdf');

/**
 * The dashed area of the "PDF do artigo" window (board 176): drop the PDF on it, or use its link to pick one.
 *
 * @example <PdfDropZone onPick={attach} onChoose={openDialog} onRejected={warn} />
 */
export const PdfDropZone: React.FC<PdfDropZoneProps> = ({ onPick, onChoose, onRejected, disabled }) => {
  const [over, setOver] = useState(false);

  // The window sits inside the project page, and a drop bubbles through the portal to the page's own handler, which
  // would import the same PDF as a new article (found in the review of PR #187). The zone keeps its events to itself.
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || disabled) return;
    if (isPdf(file)) onPick(droppedFilePath(file));
    else onRejected();
  };

  return (
    <div
      className={`pdf-drop${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <Upload size={22} aria-hidden="true" className="pdf-drop__icon" />
      <span className="pdf-drop__title">Solte o PDF aqui</span>
      <span className="pdf-drop__or">
        ou{' '}
        <button type="button" className="pdf-drop__link" onClick={onChoose} disabled={disabled}>
          escolha um arquivo
        </button>
      </span>
    </div>
  );
};
