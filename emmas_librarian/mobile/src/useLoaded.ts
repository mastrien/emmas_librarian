import { useCallback, useEffect, useState } from 'react';
import { errorText } from './errorText';

export type Loaded<T> =
  | { state: 'loading' }
  | { state: 'ready'; value: T; reload: () => void }
  | { state: 'failed'; message: string; reload: () => void };

/**
 * Loads something for a screen and says where it stands; `reload` asks again (after a write).
 * `load` must be stable between renders (wrap it in useCallback).
 *
 * @example const articles = useLoaded(useCallback(() => reader.listArticles(projectId), [reader, projectId]));
 */
export function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
  const [turn, setTurn] = useState(0);
  const [result, setResult] = useState<{ turn: number; value?: T; message?: string } | null>(null);
  const reload = useCallback(() => setTurn((current) => current + 1), []);

  useEffect(() => {
    let current = true;
    load().then(
      (value) => current && setResult({ turn, value }),
      (error: unknown) => current && setResult({ turn, message: errorText(error) }),
    );
    return () => {
      current = false;
    };
  }, [load, turn]);

  // Until the first answer; a reload keeps showing what is there, so the list does not blink.
  if (!result) return { state: 'loading' };
  if (result.message !== undefined) return { state: 'failed', message: result.message, reload };
  return { state: 'ready', value: result.value as T, reload };
}
