import { useState, useMemo, useEffect } from 'react';
import { Article } from '../../../types';

export const useProjectFiltering = (articles: Article[], itemsPerPage: number) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithPdf, setOnlyWithPdf] = useState(false);
  const [onlyOpenAccess, setOnlyOpenAccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'new' | 'read' | 'archived' | 'all'>('new');
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  
  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('emmas_librarian_sort_order') || 'added-desc';
  });

  useEffect(() => {
    localStorage.setItem('emmas_librarian_sort_order', sortOrder);
  }, [sortOrder]);

  const keywordFrequencies = useMemo(() => {
    const freqs: { [key: string]: number } = {};
    articles.forEach((a) => {
      const parse = (kStr?: string) =>
        kStr
          ? kStr
              .split(';')
              .map((k) => k.trim())
              .filter(Boolean)
          : [];
      const keywords = [...parse(a.author_keywords), ...parse(a.index_keywords)];
      keywords.forEach((kw) => {
        const trimmed = kw.trim();
        if (trimmed) {
          freqs[trimmed] = (freqs[trimmed] || 0) + 1;
        }
      });
    });
    return Object.entries(freqs)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [articles]);

  const uniqueDatabases = useMemo(() => {
    const dbs = new Set<string>();
    articles.forEach((a) => {
      if (a.source_databases) {
        try {
          const parsed = JSON.parse(a.source_databases);
          if (Array.isArray(parsed)) {
            parsed.forEach((db) => dbs.add(db));
          } else {
            dbs.add(parsed);
          }
        } catch {
          dbs.add(a.source_databases);
        }
      }
    });
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

  const [currentPage, setCurrentPage] = useState(1);
  const [isReadArticlesOpen, setIsReadArticlesOpen] = useState(false);
  const [isArchivedArticlesOpen, setIsArchivedArticlesOpen] = useState(false);

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
        try {
          const articleBases = JSON.parse(a.source_databases || '[]');
          const hasMatch = selectedDatabases.some((db) => articleBases.includes(db));
          if (!hasMatch) return false;
        } catch {
          if (a.source_databases && !selectedDatabases.includes(a.source_databases)) return false;
        }
      }

      if (selectedDocType) {
        if (a.document_type !== selectedDocType) return false;
      }

      if (selectedKeyword) {
        const parseKeywords = (kStr?: string) =>
          kStr
            ? kStr
                .split(';')
                .map((k) => k.trim().toLowerCase())
                .filter(Boolean)
            : [];
        const keywords = [...parseKeywords(a.author_keywords), ...parseKeywords(a.index_keywords)];
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
