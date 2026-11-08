import { useEffect, useRef, useState } from 'react';
import type { CitationOutputFormat } from '../../../services/citationService';
import { copyCitations, type CitationClipboard } from '../../../utils/citationClipboard';

const COPIED_FEEDBACK_MS = 2000;

/**
 * Copies citations and exposes a `copied` flag that stays true for two seconds, for "Copiado!" feedback.
 *
 * The clipboard is a parameter so tests can pass a fake.
 *
 * Usage:
 *   const { copied, copy } = useCitationCopy();
 *   <button onClick={() => copy([text], format)}>{copied ? 'Copiado!' : 'Copiar'}</button>
 */
export function useCitationCopy(clipboard: CitationClipboard = navigator.clipboard) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // An uncancelled timer fired after the test environment was gone ("window is not defined", CI run 42151615653).
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (citations: string[], format: CitationOutputFormat) => {
    await copyCitations(citations, format, clipboard);
    setCopied(true);
    // A second copy restarts the two seconds instead of being cut short by the first one's timer.
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };
  return { copied, copy };
}
