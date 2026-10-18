import { useEffect, useRef, type MutableRefObject } from 'react';
import { stripForMatching } from '../../../utils/pdfTextSearch';
import type { ViewerHighlight } from '../viewerHighlight';

/** Where "Visualizar no Documento" asked the reader to go: the evidence's text and its page. */
export interface EvidenceTarget {
  searchQuery?: string;
  page?: number;
}

/**
 * Reads the evidence target from the router state, ignoring anything else that might be there.
 *
 * Usage:
 *   const target = evidenceTargetFrom(useLocation().state);
 */
export function evidenceTargetFrom(state: unknown): EvidenceTarget | null {
  if (!state || typeof state !== 'object') return null;
  const { searchQuery, page } = state as Record<string, unknown>;
  const target: EvidenceTarget = {
    searchQuery: typeof searchQuery === 'string' && searchQuery.trim() ? searchQuery : undefined,
    page: typeof page === 'number' && page > 0 ? page : undefined,
  };
  return target.searchQuery || target.page ? target : null;
}

/**
 * The highlight the reader made from this evidence's quote, if it anchored (same text, spaces and hyphens aside).
 *
 * Usage:
 *   findEvidenceHighlight(highlights, 'precipitation forecasts');
 */
export function findEvidenceHighlight(highlights: ViewerHighlight[], quote?: string): ViewerHighlight | undefined {
  if (!quote) return undefined;
  const wanted = stripForMatching(quote);
  return highlights.find((h) => stripForMatching(h.content?.text ?? '') === wanted);
}

interface EvidenceNavigation {
  target: EvidenceTarget | null;
  /** True once the article finished loading, pending AI quotes included. */
  ready: boolean;
  highlights: ViewerHighlight[];
  highlighterRef: MutableRefObject<{ scrollTo: (h: unknown) => void } | null>;
  goToPage: (page: number) => void;
}

const POLL_MS = 250;
const MAX_POLLS = 40;

/**
 * After "Visualizar no Documento", scrolls once to the evidence's highlight, or to its page when the quote did not
 * anchor. The viewer mounts after the PDF loads, so it waits for it (up to 10 s).
 *
 * Usage:
 *   useEvidenceNavigation({ target, ready: !loading, highlights, highlighterRef, goToPage });
 */
export function useEvidenceNavigation({ target, ready, highlights, highlighterRef, goToPage }: EvidenceNavigation) {
  const done = useRef(false);
  // The latest values, read when the viewer is ready: re-renders (scrolling updates the page number) must not restart
  // the wait.
  const latest = useRef({ highlights, goToPage });
  useEffect(() => {
    latest.current = { highlights, goToPage };
  });
  const query = target?.searchQuery;
  const page = target?.page;

  useEffect(() => {
    if ((!query && !page) || !ready || done.current) return;
    let polls = 0;
    const timer = setInterval(() => {
      if (!highlighterRef.current && ++polls < MAX_POLLS) return;
      clearInterval(timer);
      done.current = true;
      const highlight = findEvidenceHighlight(latest.current.highlights, query);
      if (highlight && highlighterRef.current) highlighterRef.current.scrollTo(highlight);
      else if (page) latest.current.goToPage(page);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [query, page, ready, highlighterRef]);
}
