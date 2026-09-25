import { useState } from 'react';
import type { CitationOutputFormat } from '../../../services/citationService';
import { copyCitations } from '../../../utils/citationClipboard';

const COPIED_FEEDBACK_MS = 2000;

/**
 * Copies citations and exposes a `copied` flag that stays true for two seconds, for "Copiado!" feedback.
 *
 * Usage:
 *   const { copied, copy } = useCitationCopy();
 *   <button onClick={() => copy([text], format)}>{copied ? 'Copiado!' : 'Copiar'}</button>
 */
export function useCitationCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (citations: string[], format: CitationOutputFormat) => {
    await copyCitations(citations, format);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };
  return { copied, copy };
}
