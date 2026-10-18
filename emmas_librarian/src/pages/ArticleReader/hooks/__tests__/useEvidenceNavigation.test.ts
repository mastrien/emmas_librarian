import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evidenceTargetFrom, findEvidenceHighlight, useEvidenceNavigation } from '../useEvidenceNavigation';
import type { ViewerHighlight } from '../../viewerHighlight';

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn() }));

const highlight = (id: string, text: string): ViewerHighlight => ({
  id,
  article_id: 1,
  position: { pageNumber: 3 },
  content: { text },
  comment: { text: '', emoji: '🤖' },
  color: '#fde047',
});

describe('evidence navigation in the reader', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads only a usable text and page from the router state', () => {
    expect(evidenceTargetFrom({ searchQuery: 'rain', page: 3 })).toEqual({ searchQuery: 'rain', page: 3 });
    expect(evidenceTargetFrom({ searchQuery: '  ', page: 0 })).toBeNull();
    expect(evidenceTargetFrom(null)).toBeNull();
    expect(evidenceTargetFrom({ other: 1 })).toBeNull();
  });

  it('finds the AI highlight made from the evidence, spaces and hyphens aside', () => {
    const list = [highlight('a', 'other text'), highlight('b', 'precipi-\ntation  forecasts')];

    expect(findEvidenceHighlight(list, 'precipitation forecasts')?.id).toBe('b');
    expect(findEvidenceHighlight(list, undefined)).toBeUndefined();
  });

  function run(target: { searchQuery?: string; page?: number }, highlights: ViewerHighlight[], ready = true) {
    const scrollTo = vi.fn();
    const goToPage = vi.fn();
    const highlighterRef = { current: { scrollTo } };
    renderHook(() => useEvidenceNavigation({ target, ready, highlights, highlighterRef, goToPage }));
    vi.advanceTimersByTime(300);
    return { scrollTo, goToPage };
  }

  it('scrolls to the evidence’s highlight once the article is ready', () => {
    const target = highlight('b', 'precipitation forecasts');

    const { scrollTo, goToPage } = run({ searchQuery: 'precipitation forecasts', page: 7 }, [target]);

    expect(scrollTo).toHaveBeenCalledWith(target);
    expect(goToPage).not.toHaveBeenCalled();
  });

  it('opens on the evidence’s page when its quote did not become a highlight', () => {
    const { scrollTo, goToPage } = run({ searchQuery: 'not anchored', page: 7 }, []);

    expect(goToPage).toHaveBeenCalledWith(7);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('waits while the article is loading', () => {
    const { scrollTo, goToPage } = run({ page: 7 }, [], false);

    expect(goToPage).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
