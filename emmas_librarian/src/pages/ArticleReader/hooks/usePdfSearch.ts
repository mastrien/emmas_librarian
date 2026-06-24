import { useState, useEffect, RefObject } from 'react';

interface SearchResult {
  pageNumber: number;
  snippet: string;
  matchIndex: number;
  highlightStart: number;
}

interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNum: number) => Promise<{
    getTextContent: () => Promise<{
      items: { str: string; hasEOL?: boolean }[];
    }>;
  }>;
}

export function usePdfSearch(
  sidebarTab: string,
  highlighterRef: RefObject<{ scrollTo: (h: unknown) => void }>,
  setCurrentPage: (p: number) => void,
  setInputPage: (p: string) => void,
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (pdfDoc: PdfDocumentProxy | null) => {
    if (!searchQuery.trim() || !pdfDoc) return;
    setIsSearching(true);
    setSearchResults([]);
    const results: SearchResult[] = [];

    try {
      const totalPages = pdfDoc.numPages;
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        const textItems = textContent.items.map(
          (item: { str: string; hasEOL?: boolean }) => item.str + (item.hasEOL ? '\n' : ''),
        );
        const fullText = textItems.join('');

        let index = 0;
        const queryLower = searchQuery.toLowerCase();
        const textLower = fullText.toLowerCase();

        while ((index = textLower.indexOf(queryLower, index)) !== -1) {
          const start = Math.max(0, index - 40);
          const end = Math.min(fullText.length, index + queryLower.length + 45);
          let snippet = fullText.substring(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < fullText.length) snippet = snippet + '...';

          results.push({
            pageNumber: pageNum,
            snippet: snippet,
            matchIndex: index,
            highlightStart: index - start + (start > 0 ? 3 : 0),
          });

          index += queryLower.length;
        }
      }
      setSearchResults(results);
    } catch (err) {
      console.error('Erro ao pesquisar no PDF:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (pageNum: number) => {
    if (highlighterRef.current) {
      try {
        highlighterRef.current.scrollTo({
          position: {
            pageNumber: pageNum,
            boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1 },
          },
        });
        setCurrentPage(pageNum);
        setInputPage(pageNum.toString());
      } catch (e) {
        console.error('Erro ao scrollar para a página:', e);
      }
    }
  };

  useEffect(() => {
    let isActive = true;
    let initialTimer: ReturnType<typeof setTimeout>;
    let observerTimer: ReturnType<typeof setTimeout>;

    const cleanupDom = () => {
      document.querySelectorAll('.textLayer span mark').forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.textContent = parent.textContent;
        }
      });
      document.querySelectorAll('.textLayer').forEach((layer) => {
        Array.from(layer.attributes).forEach((attr) => {
          if (attr.name.startsWith('data-search-highlighted')) {
            layer.removeAttribute(attr.name);
          }
        });
      });
    };

    if (sidebarTab === 'search' && !isSearching && searchQuery.trim().length > 2) {
      const query = searchQuery.trim().toLowerCase();

      const highlightText = () => {
        if (!isActive) return;

        const executeHighlight = () => {
          if (!isActive) return;
          const textLayers = document.querySelectorAll('.textLayer');

          const queryKey = query.replace(/[^a-z0-9]/g, '_');

          textLayers.forEach((layer) => {
            if (layer.hasAttribute('data-search-highlighted-' + queryKey)) return;
            layer.setAttribute('data-search-highlighted-' + queryKey, 'true');

            const spans = layer.querySelectorAll('span');
            spans.forEach((span) => {
              // Only mutate pure text nodes to avoid breaking complex pdf.js internal structures
              if (span.children.length > 0 && !span.querySelector('mark')) return;

              if (!span.querySelector('mark') && span.textContent && span.textContent.toLowerCase().includes(query)) {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedQuery})`, 'gi');

                const safeText = span.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                span.innerHTML = safeText.replace(
                  regex,
                  '<mark style="background-color: rgba(234, 179, 8, 0.4); color: inherit; border-radius: 2px;">$1</mark>',
                );
              }
            });
          });
        };

        // Use requestIdleCallback to wait for pdf.js to finish its heavy layout calculations
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(executeHighlight, { timeout: 1000 });
        } else {
          executeHighlight();
        }
      };

      initialTimer = setTimeout(highlightText, 400);

      const observer = new MutationObserver((mutations) => {
        let shouldHighlight = false;
        mutations.forEach((m) => {
          if (m.addedNodes.length) shouldHighlight = true;
        });
        if (shouldHighlight) {
          if (observerTimer) clearTimeout(observerTimer);
          observerTimer = setTimeout(highlightText, 400);
        }
      });

      const viewer = document.getElementById('pdf-container');
      if (viewer) {
        observer.observe(viewer, { childList: true, subtree: true });
      }

      return () => {
        isActive = false;
        clearTimeout(initialTimer);
        if (observerTimer) clearTimeout(observerTimer);
        observer.disconnect();
        cleanupDom();
      };
    } else {
      // Cleanup highlights if tab is changed or query is cleared
      cleanupDom();
    }
  }, [searchQuery, isSearching, sidebarTab]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    handleSearch,
    handleResultClick,
  };
}
