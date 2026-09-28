import { useState, useMemo, useEffect } from 'react';
import { Article } from '../../../types';
import { useSessionState } from '../../../hooks/useSessionState';
import { parseSourceDatabases } from '../../../utils/sourceDatabases';

// Author and index keywords are stored as semicolon-separated strings.
function articleKeywords(article: Article): string[] {
  return [article.author_keywords, article.index_keywords].flatMap((field) =>
    (field ?? '')
      .split(';')
      .map((k) => k.trim())
      .filter(Boolean),
  );
}

/**
 * Per-project view state kept for the app session, so filters, page and open sections survive a
 * trip to the PDF reader (a user asked for it: coming back used to reset everything).
 *
 * @example const [page, setPage] = useProjectViewState(7, 'currentPage', 1);
 */
export function useProjectViewState<T>(projectId: number | null, name: string, initial: T) {
  return useSessionState(`project.${projectId ?? 'none'}.view.${name}`, initial);
}

export const useProjectFiltering = (articles: Article[], itemsPerPage: number, projectId: number | null = null) => {
  const [searchTerm, setSearchTerm] = useProjectViewState(projectId, 'searchTerm', '');
  const [onlyWithPdf, setOnlyWithPdf] = useProjectViewState(projectId, 'onlyWithPdf', false);
  const [onlyOpenAccess, setOnlyOpenAccess] = useProjectViewState(projectId, 'onlyOpenAccess', false);
  const [statusFilter, setStatusFilter] = useProjectViewState<'new' | 'read' | 'archived' | 'all'>(
    projectId,
    'statusFilter',
    'new',
  );
  const [selectedDatabases, setSelectedDatabases] = useProjectViewState<string[]>(projectId, 'databases', []);
  const [selectedDocType, setSelectedDocType] = useProjectViewState(projectId, 'docType', '');
  const [selectedKeyword, setSelectedKeyword] = useProjectViewState(projectId, 'keyword', '');

  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('emmas_librarian_sort_order') || 'added-desc';
  });

  useEffect(() => {
    localStorage.setItem('emmas_librarian_sort_order', sortOrder);
  }, [sortOrder]);

  const keywordFrequencies = useMemo(() => {
    const freqs: { [key: string]: number } = {};
    articles.forEach((a) => {
      articleKeywords(a).forEach((kw) => {
        freqs[kw] = (freqs[kw] || 0) + 1;
      });
    });
    return Object.entries(freqs)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [articles]);

  const uniqueDatabases = useMemo(() => {
    const dbs = new Set<string>();
    articles.forEach((a) => parseSourceDatabases(a.source_databases).forEach((db) => dbs.add(db)));
    return Array.from(dbs);
  }, [articles]);

  const uniqueDocTypes = useMemo(() => {
    const types = new Set<string>();
    articles.forEach((a) => {
      if (a.document_type) {
        types.add(a.document_type);
      }
    });
    return Array.from(types);
  }, [articles]);

  const [currentPage, setCurrentPage] = useProjectViewState(projectId, 'currentPage', 1);
  const [isReadArticlesOpen, setIsReadArticlesOpen] = useProjectViewState(projectId, 'readOpen', false);
  const [isArchivedArticlesOpen, setIsArchivedArticlesOpen] = useProjectViewState(projectId, 'archivedOpen', false);

  const activeArticles = useMemo(() => {
    const filtered = articles.filter((a) => {
      const matchesSearch =
        (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.authors || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPdf = !onlyWithPdf || !!a.local_file_path;
      const matchesOpenAccess = !onlyOpenAccess || a.is_oa === 1;
      return matchesSearch && matchesPdf && matchesOpenAccess;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortOrder) {
        case 'year-desc':
          return (parseInt(b.year?.toString() || '0') || 0) - (parseInt(a.year?.toString() || '0') || 0);
        case 'year-asc':
          return (parseInt(a.year?.toString() || '0') || 0) - (parseInt(b.year?.toString() || '0') || 0);
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '');
        case 'added-desc':
          return (b.id || 0) - (a.id || 0);
        case 'added-asc':
          return (a.id || 0) - (b.id || 0);
        case 'citations-desc':
          return (b.citation_count || 0) - (a.citation_count || 0);
        case 'citations-asc':
          return (a.citation_count || 0) - (b.citation_count || 0);
        default:
          return 0;
      }
    });

    return sorted.filter((a) => {
      if (statusFilter === 'new') {
        if (a.status !== 'new' && !!a.status) return false;
      } else if (statusFilter === 'read') {
        if (a.status !== 'read') return false;
      } else if (statusFilter === 'archived') {
        if (a.status !== 'archived') return false;
      }

      if (selectedDatabases.length > 0) {
        const articleBases = parseSourceDatabases(a.source_databases);
        if (!selectedDatabases.some((db) => articleBases.includes(db))) return false;
      }

      if (selectedDocType) {
        if (a.document_type !== selectedDocType) return false;
      }

      if (selectedKeyword) {
        const keywords = articleKeywords(a).map((k) => k.toLowerCase());
        if (!keywords.includes(selectedKeyword.toLowerCase())) return false;
      }

      return true;
    });
  }, [
    articles,
    searchTerm,
    onlyWithPdf,
    onlyOpenAccess,
    statusFilter,
    selectedDatabases,
    selectedDocType,
    selectedKeyword,
    sortOrder,
  ]);

  const readArticles = useMemo(() => articles.filter((a) => a.status === 'read'), [articles]);
  const archivedArticles = useMemo(() => articles.filter((a) => a.status === 'archived'), [articles]);
  const filteredArticles = activeArticles;

  const totalPages = Math.ceil(activeArticles.length / itemsPerPage);
  const paginatedArticles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeArticles.slice(start, start + itemsPerPage);
  }, [activeArticles, currentPage, itemsPerPage]);

  return {
    itemsPerPage,
    searchTerm,
    setSearchTerm,
    onlyWithPdf,
    setOnlyWithPdf,
    onlyOpenAccess,
    setOnlyOpenAccess,
    statusFilter,
    setStatusFilter,
    selectedDatabases,
    setSelectedDatabases,
    selectedDocType,
    setSelectedDocType,
    selectedKeyword,
    setSelectedKeyword,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    keywordFrequencies,
    uniqueDatabases,
    uniqueDocTypes,
    activeArticles,
    readArticles,
    archivedArticles,
    filteredArticles,
    totalPages,
    paginatedArticles,
    isReadArticlesOpen,
    setIsReadArticlesOpen,
    isArchivedArticlesOpen,
    setIsArchivedArticlesOpen,
  };
};

export type ProjectFiltering = ReturnType<typeof useProjectFiltering>;
