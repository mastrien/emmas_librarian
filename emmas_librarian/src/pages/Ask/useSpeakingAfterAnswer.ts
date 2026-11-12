import { useEffect, useState } from 'react';

/** How long the rings keep "speaking" after an answer arrives: the answer shows all at once, so it needs a pause to be seen. */
export const SPEAKING_MS = 5000;

/**
 * True for five seconds after a question that was on its way gets its answer, so the rings beside the answer can show
 * that it "spoke" (the text appears whole, with no typing to show it). A new question ends it at once; opening a
 * conversation that was already answered does not start it.
 *
 * @example const speaking = useSpeakingAfterAnswer(ask.pending); <AskRings state={speaking ? 'speaking' : 'idle'} />
 */
export function useSpeakingAfterAnswer(pending: string | null, ms: number = SPEAKING_MS): boolean {
  const [previous, setPrevious] = useState(pending);
  const [speaking, setSpeaking] = useState(false);
  // Worked out while rendering, from the change in `pending`: an effect would draw the page once more for nothing.
  if (previous !== pending) {
    setPrevious(pending);
    setSpeaking(previous !== null && pending === null);
  }
  useEffect(() => {
    if (!speaking) return;
    const timer = setTimeout(() => setSpeaking(false), ms);
    return () => clearTimeout(timer);
  }, [speaking, ms]);
  return speaking;
}
