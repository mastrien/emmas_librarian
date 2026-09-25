import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { Article, Project } from '../../../types';
import type { ProjectModals } from './useProjectModals';

type ArticleStatus = Article['status'];

interface ProjectActionsOptions {
  projectId: number | null;
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  modals: ProjectModals;
  reload: () => Promise<void>;
}

/**
 * User actions of the project page (rename/delete the project, change article status,
 * PDF links, search revert, article forms). Each failure is reported with an alert.
 *
 * Usage:
 *   const actions = useProjectActions({ projectId, project, setProject, articles, setArticles, modals, reload });
 */
export function useProjectActions(options: ProjectActionsOptions) {
  const { projectId, articles, setArticles, modals, reload } = options;
  const projectService = useProjectService();

  const changeStatus = useCallback(
    async (articleId: number, status: ArticleStatus, note?: string) => {
      try {
        await projectService.updateArticleStatus(articleId, status, note);
        setArticles((prev) => prev.map((a) => (a.id === articleId ? { ...a, status, archive_note: note } : a)));
      } catch (e) {
        alert(`Erro ao atualizar status do artigo: ${(e as Error).message}`);
      }
    },
    [projectService, setArticles],
  );

  const unlinkPdf = useCallback(
    async (articleId: number) => {
      const confirmed = window.confirm(
        'Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.',
      );
      if (!confirmed) return;
      await alertOnFailure('Erro ao desvincular o PDF', async () => {
        await projectService.unlinkPdf(articleId);
        await reload();
      });
    },
    [projectService, reload],
  );

  const attachPdf = useCallback(
    (articleId: number) => {
      const article = articles.find((a) => a.id === articleId);
      if (article) modals.setAttachPdfArticle({ id: article.id, title: article.title });
    },
    [articles, modals],
  );

  const revertSearch = (searchId: number) =>
    alertOnFailure('Erro ao desfazer a busca', async () => {
      await projectService.revertSearch(searchId);
      await reload();
    });

  const archive = (note: string) => {
    if (!modals.archivingId) return;
    changeStatus(modals.archivingId, 'archived', note);
    modals.setArchivingId(null);
  };

  const createManualArticle = async (data: Partial<Article>, filePath?: string) => {
    if (projectId === null) return;
    await projectService.createManualArticle(projectId, data, filePath);
    await reload();
  };

  const editArticle = async (data: Partial<Article>) => {
    if (!modals.editingArticle) return;
    await projectService.updateArticleMetadata(modals.editingArticle.id, data);
    await reload();
  };

  return {
    changeStatus,
    unlinkPdf,
    attachPdf,
    revertSearch,
    archive,
    createManualArticle,
    editArticle,
    ...useProjectHeaderActions(options),
  };
}

function useProjectHeaderActions({ projectId, project, setProject }: ProjectActionsOptions) {
  const projectService = useProjectService();
  const navigate = useNavigate();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (project) setNewName(project.name);
  }, [project]);

  const saveName = async () => {
    const trimmed = newName.trim();
    if (projectId === null || !trimmed) return;
    await alertOnFailure('Erro ao atualizar nome do projeto', async () => {
      await projectService.updateProject(projectId, trimmed);
      setProject((prev) => (prev ? { ...prev, name: trimmed } : null));
      setIsEditingName(false);
    });
  };

  const deleteProject = async () => {
    if (projectId === null || !project) return;
    const message = `Tem certeza que deseja excluir o projeto "${project.name}"? Todos os artigos e anotações serão perdidos permanentemente.`;
    if (!window.confirm(message)) return;
    await alertOnFailure('Erro ao excluir projeto', async () => {
      await projectService.deleteProject(projectId);
      navigate('/');
    });
  };

  return { isEditingName, setIsEditingName, newName, setNewName, saveName, deleteProject };
}

async function alertOnFailure(message: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    alert(message);
  }
}
