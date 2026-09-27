import { useState, useMemo, useEffect, useCallback } from 'react';
import { Article } from '../../../types';
import { useSessionState } from '../../../hooks/useSessionState';
import { parseSourceDatabases } from '../../../utils/sourceDatabases';
import { articleKeywords, countWith, matchesFilters, type ArticleFilterCriteria } from './articleFilters';

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

  const criteria: ArticleFilterCriteria = useMemo(
    () => ({
      searchTerm,
      onlyWithPdf,
      onlyOpenAccess,
      statusFilter,
      databases: selectedDatabases,
      docType: selectedDocType,
      keyword: selectedKeyword,
    }),
    [searchTerm, onlyWithPdf, onlyOpenAccess, statusFilter, selectedDatabases, selectedDocType, selectedKeyword],
  );

  // Applies a whole set of filters at once (a chip removed, "Limpar filtros") and goes back to page 1.
  const applyCriteria = useCallback(
    (next: ArticleFilterCriteria) => {
      setSearchTerm(next.searchTerm);
      setOnlyWithPdf(next.onlyWithPdf);
      setOnlyOpenAccess(next.onlyOpenAccess);
      setStatusFilter(next.statusFilter);
      setSelectedDatabases(next.databases);
      setSelectedDocType(next.docType);
      setSelectedKeyword(next.keyword);
      setCurrentPage(1);
    },
    [
      setSearchTerm,
      setOnlyWithPdf,
      setOnlyOpenAccess,
      setStatusFilter,
      setSelectedDatabases,
      setSelectedDocType,
      setSelectedKeyword,
      setCurrentPage,
    ],
  );

  const countFor = useCallback(
    (patch: Partial<ArticleFilterCriteria>) => countWith(articles, criteria, patch),
    [articles, criteria],
  );

  const activeArticles = useMemo(
    () =>
      sortArticles(
        articles.filter((a) => matchesFilters(a, criteria)),
        sortOrder,
      ),
    [articles, criteria, sortOrder],
  );

  const readArticles = useMemo(() => articles.filter((a) => a.status === 'read'), [articles]);
  const archivedArticles = useMemo(() => articles.filter((a) => a.status === 'archived'), [articles]);
  const filteredArticles = activeArticles;

  const totalPages = Math.ceil(activeArticles.length / itemsPerPage);
  const paginatedArticles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeArticles.slice(start, start + itemsPerPage);
  }, [activeArticles, currentPage, itemsPerPage]);

  return {
    criteria,
    applyCriteria,
    countFor,
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

function sortArticles(articles: Article[], sortOrder: string): Article[] {
  const year = (a: Article) => parseInt(a.year?.toString() || '0') || 0;
  const compare: Record<string, (a: Article, b: Article) => number> = {
    'year-desc': (a, b) => year(b) - year(a),
    'year-asc': (a, b) => year(a) - year(b),
    'title-asc': (a, b) => (a.title || '').localeCompare(b.title || ''),
    'title-desc': (a, b) => (b.title || '').localeCompare(a.title || ''),
    'added-desc': (a, b) => (b.id || 0) - (a.id || 0),
    'added-asc': (a, b) => (a.id || 0) - (b.id || 0),
    'citations-desc': (a, b) => (b.citation_count || 0) - (a.citation_count || 0),
    'citations-asc': (a, b) => (a.citation_count || 0) - (b.citation_count || 0),
  };
  const byOrder = compare[sortOrder];
  return byOrder ? [...articles].sort(byOrder) : articles;
}
