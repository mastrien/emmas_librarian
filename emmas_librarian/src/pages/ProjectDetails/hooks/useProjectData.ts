import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import type {
  Article,
  ArticleCategory,
  MassiveInvestigation,
  Project,
  ProjectCategory,
  ProjectDocument,
  SearchHistoryItem,
} from '../../../types';

/**
 * Loads everything the project page shows and exposes a `reload` for after mutations.
 * `onArticlesReloaded` lets callers refresh state derived from the articles (e.g. an open details modal).
 *
 * Usage:
 *   const data = useProjectData(projectId, (articles) => refreshSelection(articles));
 */
export function useProjectData(projectId: number | null, onArticlesReloaded?: (articles: Article[]) => void) {
  const projectService = useProjectService();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([]);
  const [investigationHistory, setInvestigationHistory] = useState<MassiveInvestigation[]>([]);
  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
  const [articleCategories, setArticleCategories] = useState<ArticleCategory[]>([]);
  // Kept in a ref so a new callback identity does not re-trigger the initial load.
  const articlesReloaded = useRef(onArticlesReloaded);
  articlesReloaded.current = onArticlesReloaded;

  const reload = useCallback(async () => {
    if (projectId === null) return;
    try {
      const [proj, arts, hist, docs, investigations, categories, assignments] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getArticles(projectId),
        projectService.getSearchHistory(projectId),
        projectService.getProjectDocuments(projectId),
        projectService.getMassiveInvestigations(projectId),
        projectService.getProjectCategories(projectId),
        projectService.getAllProjectArticleCategories(projectId),
      ]);
      setProject(proj);
      setArticles(arts);
      articlesReloaded.current?.(arts);
      setHistory(hist);
      setProjectDocuments(docs);
      setInvestigationHistory(investigations);
      setProjectCategories(categories);
      setArticleCategories(assignments);
    } catch (err) {
      console.error('Erro ao carregar dados do projeto', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, projectService]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    loading,
    project,
    setProject,
    articles,
    setArticles,
    history,
    projectDocuments,
    investigationHistory,
    setInvestigationHistory,
    projectCategories,
    articleCategories,
    reload,
  };
}
