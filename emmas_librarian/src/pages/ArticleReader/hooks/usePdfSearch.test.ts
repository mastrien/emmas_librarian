import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePdfSearch } from './usePdfSearch';
import { RefObject } from 'react';

describe('usePdfSearch', () => {
  let highlighterRef: RefObject<{ scrollTo: (h: unknown) => void }>;
  let setCurrentPage: ReturnType<typeof vi.fn>;
  let setInputPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    highlighterRef = { current: { scrollTo: vi.fn() } };
    setCurrentPage = vi.fn();
    setInputPage = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => usePdfSearch('search', highlighterRef, setCurrentPage, setInputPage));
    expect(result.current.searchQuery).toBe('');
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it('does not search if query is empty', async () => {
    const { result } = renderHook(() => usePdfSearch('search', highlighterRef, setCurrentPage, setInputPage));
    const mockPdfDoc = {
      numPages: 1,
      getPage: vi.fn(),
    };
    
    await act(async () => {
      await result.current.handleSearch(mockPdfDoc);
    });

    expect(mockPdfDoc.getPage).not.toHaveBeenCalled();
    expect(result.current.isSearching).toBe(false);
  });

  it('searches pdf text successfully', async () => {
    const { result } = renderHook(() => usePdfSearch('search', highlighterRef, setCurrentPage, setInputPage));
    
    const mockPdfDoc = {
      numPages: 2,
      getPage: vi.fn().mockImplementation((pageNum) => {
        if (pageNum === 1) {
          return Promise.resolve({
            getTextContent: () => Promise.resolve({
              items: [
                { str: 'Hello world! ' },
                { str: 'This is a test.', hasEOL: true },
                { str: 'Another line of testing.' }
              ]
            })
          });
        }
        return Promise.resolve({
          getTextContent: () => Promise.resolve({
            items: [{ str: 'Page two content without match' }]
          })
        });
      }),
    };

    act(() => {
      result.current.setSearchQuery('test');
    });

    await act(async () => {
      await result.current.handleSearch(mockPdfDoc);
    });

    expect(result.current.searchResults).toHaveLength(2);
    expect(result.current.searchResults[0].pageNumber).toBe(1);
    expect(result.current.searchResults[0].snippet).toContain('This is a test.');
    expect(result.current.searchResults[1].pageNumber).toBe(1);
    expect(result.current.searchResults[1].snippet).toContain('Another line of test');
  });

  it('handles error in handleSearch', async () => {
    const { result } = renderHook(() => usePdfSearch('search', highlighterRef, setCurrentPage, setInputPage));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockPdfDoc = {
      numPages: 1,
      getPage: vi.fn().mockRejectedValue(new Error('fail')),
    };

    act(() => {
      result.current.setSearchQuery('test');
    });

    await act(async () => {
      await result.current.handleSearch(mockPdfDoc);
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('scrolls to result on handleResultClick', () => {
    const { result } = renderHook(() => usePdfSearch('search', highlighterRef, setCurrentPage, setInputPage));

    act(() => {
      result.current.handleResultClick(2);
    });

    expect(highlighterRef.current!.scrollTo).toHaveBeenCalledWith({
      position: {
        pageNumber: 2,
        boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1 },
      }
    });
    expect(setCurrentPage).toHaveBeenCalledWith(2);
    expect(setInputPage).toHaveBeenCalledWith('2');
  });

  it('handles error in handleResultClick', () => {
    const errorHighlighterRef = { current: { scrollTo: vi.fn().mockImplementation(() => { throw new Error('fail'); }) } };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePdfSearch('search', errorHighlighterRef as any, setCurrentPage, setInputPage));

    act(() => {
      result.current.handleResultClick(2);
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('highlights text in DOM when sidebar is open and query is > 2 chars', async () => {
    // Mock DOM elements
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'pdf-container';
    
    const mockElement = document.createElement('div');
    mockElement.className = 'textLayer';
    const mockSpan = document.createElement('span');
    mockSpan.textContent = 'something about testing here';
    mockElement.appendChild(mockSpan);
    pdfContainer.appendChild(mockElement);
    document.body.appendChild(pdfContainer);

    const { result, unmount } = renderHook(() => usePdfSearch('search', highlighterRef, setCurrentPage, setInputPage));

    act(() => {
      result.current.setSearchQuery('test');
    });

    // Wait for setTimeout
    act(() => {
      vi.runAllTimers();
    });

    expect(mockSpan.innerHTML).toContain('<mark');
    // Trigger mutation observer by adding a new layer
    const newLayer = document.createElement('div');
    newLayer.className = 'textLayer';
    const newSpan = document.createElement('span');
    newSpan.textContent = 'another test line';
    newLayer.appendChild(newSpan);
    pdfContainer.appendChild(newLayer);
    
    // Trigger it again to cover clearTimeout branch
    const newLayer2 = document.createElement('div');
    newLayer2.className = 'textLayer';
    const newSpan2 = document.createElement('span');
    newSpan2.textContent = 'one more test string';
    newLayer2.appendChild(newSpan2);
    pdfContainer.appendChild(newLayer2);
    
    // MutationObserver is a microtask. Wait a microtick before advancing timers.
    await Promise.resolve();
    
    // Wait for mutation observer setTimeout
    act(() => {
      vi.runAllTimers();
    });
    
    expect(newSpan.innerHTML).toContain('<mark');

    // Clear dom
    document.body.innerHTML = '';
    unmount();
  });

  it('uses requestIdleCallback if available', async () => {
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'pdf-container';
    document.body.appendChild(pdfContainer);

    window.requestIdleCallback = vi.fn();

    const { result, unmount } = renderHook(() => usePdfSearch('search', highlighterRef, setCurrentPage, setInputPage));

    act(() => {
      result.current.setSearchQuery('test');
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(window.requestIdleCallback).toHaveBeenCalled();

    delete (window as any).requestIdleCallback;
    document.body.innerHTML = '';
    unmount();
  });

  it('clears highlights when query changes or tab changes', () => {
    const mockElement = document.createElement('div');
    mockElement.className = 'textLayer';
    mockElement.setAttribute('data-search-highlighted-test', 'true');
    const mockSpan = document.createElement('span');
    mockSpan.innerHTML = 'something <mark>test</mark> here';
    mockElement.appendChild(mockSpan);
    document.body.appendChild(mockElement);

    const { unmount } = renderHook(() => usePdfSearch('other-tab', highlighterRef, setCurrentPage, setInputPage));

    expect(mockSpan.innerHTML).not.toContain('<mark'); // cleanupDom should remove marks
    
    document.body.innerHTML = '';
    unmount();
  });
});
