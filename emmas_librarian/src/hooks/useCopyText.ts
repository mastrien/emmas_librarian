import { useEffect, useRef, useState } from 'react';

const COPIED_FEEDBACK_MS = 2000;

/** The slice of the Clipboard API used to copy plain text. */
export interface TextClipboard {
  writeText(text: string): Promise<void>;
}

/**
 * Copies plain text and exposes a `copied` flag that stays true for two seconds, so a button can say "Copiado!".
 * A clipboard that refuses (no permission) leaves `copied` false: the button must not claim a copy that did not happen.
 * The clipboard is a parameter so tests can pass a fake.
 *
 * @example
 * const { copied, copy } = useCopyText();
 * <button onClick={() => copy(errorText)}>{copied ? 'Copiado!' : 'Copiar'}</button>
 */
export function useCopyText(clipboard: TextClipboard | undefined = navigator.clipboard) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    try {
      await clipboard?.writeText(text);
    } catch (err) {
      console.error('Não foi possível copiar para a área de transferência:', err);
      return;
    }
    if (!clipboard) return;
    setCopied(true);
    // A second copy restarts the two seconds instead of being cut short by the first one's timer.
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };
  return { copied, copy };
}
