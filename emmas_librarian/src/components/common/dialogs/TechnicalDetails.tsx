import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** How long "Copiado" stays on the button, in ms. */
const COPIED_FOR_MS = 2000;

/**
 * The folded "Detalhes técnicos" of an error window (board 181): what the program said, for someone who has to report
 * it, and a button that copies it. Closed by default so the plain sentence stays the first thing read.
 *
 * @example <TechnicalDetails text="ENOENT: no such file or directory, open 'a.pdf'" />
 */
export const TechnicalDetails: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FOR_MS);
  };
  return (
    <details className="app-dialog-details">
      <summary>Detalhes técnicos</summary>
      <pre>{text}</pre>
      <button type="button" className="app-dialog-copy" onClick={copy}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? 'Copiado' : 'Copiar detalhes'}
      </button>
    </details>
  );
};
