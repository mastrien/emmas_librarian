import { describe, it, expect, vi } from 'vitest';
import { scrollViewerTo } from '../viewerHighlight';

// Clicking a highlight in the annotations list did nothing: the handler passed to the sidebar was empty.
describe('scrollViewerTo', () => {
  it('scrolls the viewer to the clicked highlight', () => {
    const scrollTo = vi.fn();
    const highlight = { id: 'h1', position: { pageNumber: 4 } };

    scrollViewerTo({ current: { scrollTo } }, highlight);

    expect(scrollTo).toHaveBeenCalledWith(highlight);
  });

  it('does nothing before the viewer is mounted', () => {
    expect(() => scrollViewerTo({ current: null }, { id: 'h1' })).not.toThrow();
  });
});
