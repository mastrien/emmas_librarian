import { useState, useMemo } from 'react';
import { Article } from '../types';

export function useArticleFilters(articles: Article[], articleCategories: Record<number, number[]>) {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (selectedStatus && article.status !== selectedStatus) return false;

      if (selectedDatabase) {
        if (selectedDatabase === 'MANUAL' && !!article.search_id) return false;
        if (
          selectedDatabase !== 'MANUAL' &&
          (!article.source_databases || article.source_databases.toUpperCase() !== selectedDatabase)
        )
          return false;
      }

      if (selectedDocType) {
        if (selectedDocType === 'with_pdf' && !!!article.local_file_path) return false;
        if (selectedDocType === 'without_pdf' && !!article.local_file_path) return false;
      }

      if (selectedCategory !== null) {
        const cats = articleCategories[article.id] || [];
        if (!cats.includes(selectedCategory)) return false;
      }

      if (selectedKeyword) {
        const k = selectedKeyword.toLowerCase();
        const t = (article.title || '').toLowerCase();
        const a = (article.abstract || '').toLowerCase();
        const au = (article.authors || '').toLowerCase();
        if (!t.includes(k) && !a.includes(k) && !au.includes(k)) return false;
      }

      return true;
    });
  }, [
    articles,
    selectedStatus,
    selectedDatabase,
    selectedDocType,
    selectedKeyword,
    selectedCategory,
    articleCategories,
  ]);

  return {
    selectedStatus,
    setSelectedStatus,
    selectedDatabase,
    setSelectedDatabase,
    selectedDocType,
    setSelectedDocType,
    selectedKeyword,
    setSelectedKeyword,
    selectedCategory,
    setSelectedCategory,
    filteredArticles,
  };
}
