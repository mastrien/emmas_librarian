/**
 * The page the reader's back arrow returns to, when it was opened from somewhere other than the project page:
 * the review page or the guided screening (validation of epic #44: back from a PDF in the guided screening led
 * to the project page, and the whole way back had to be redone). It travels in the router state.
 */
export interface ReaderBack {
  path: string;
  label: string;
}

/**
 * The router state that opens the reader and remembers the page to return to.
 *
 * @example <Link to={`/articles/${id}`} state={readerStateBackTo({ path: `/projects/3/review/guided`, label: 'Voltar à triagem guiada' })} />
 */
export function readerStateBackTo(back: ReaderBack): { backTo: ReaderBack } {
  return { backTo: back };
}

/**
 * The page to return to, read from the reader's router state; null when the reader was opened another way. Only
 * paths inside a project are accepted, so the state can never send the reader elsewhere.
 *
 * @example const back = readerBackFrom(useLocation().state);
 */
export function readerBackFrom(state: unknown): ReaderBack | null {
  if (!state || typeof state !== 'object') return null;
  const back = (state as Record<string, unknown>).backTo;
  if (!back || typeof back !== 'object') return null;
  const { path, label } = back as Record<string, unknown>;
  if (typeof path !== 'string' || !/^\/projects\/\d+(\/[\w/-]*)?$/.test(path)) return null;
  return typeof label === 'string' && label.trim() ? { path, label } : null;
}
