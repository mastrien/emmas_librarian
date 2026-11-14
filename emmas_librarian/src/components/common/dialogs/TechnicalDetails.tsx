import React from 'react';
import { Check, Copy } from 'lucide-react';
import { useCopyText } from '../../../hooks/useCopyText';

/**
 * The folded "Detalhes técnicos" of an error window (board 181): what the program said, for someone who has to report
 * it, and a button that copies it. Closed by default so the plain sentence stays the first thing read. Copying goes
 * through useCopyText, which keeps "Copiado" honest when the clipboard refuses and clears its timer on unmount.
 *
 * @example <TechnicalDetails text="ENOENT: no such file or directory, open 'a.pdf'" />
 */
export const TechnicalDetails: React.FC<{ text: string }> = ({ text }) => {
  const { copied, copy } = useCopyText();
  return (
    <details className="app-dialog-details">
      <summary>Detalhes técnicos</summary>
      <pre>{text}</pre>
      <button type="button" className="app-dialog-copy" onClick={() => void copy(text)}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? 'Copiado' : 'Copiar detalhes'}
      </button>
    </details>
  );
};
