import { useState } from 'react';
import type { Article, Project } from '../../types';
import type { IProjectService } from '../../services/ProjectServiceInterface';
import type { PdfFileRecord } from './pdfLibraryData';

/**
 * The state of the "Vincular" window: which PDF, the projects, the chosen project's articles without a PDF, and the
 * chosen article. `confirm` links and calls `onLinked`; a failure goes to `onError` with its message.
 *
 * @example const link = usePdfLink(service, loadData, (msg) => report(msg)); link.open(pdf);
 */
export function usePdfLink(service: IProjectService, onLinked: () => void, onError: (message: string) => void) {
  const [pdf, setPdf] = useState<PdfFileRecord | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | ''>('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleId, setArticleId] = useState<number | ''>('');

  const close = () => {
    setPdf(null);
    setProjectId('');
    setArticles([]);
    setArticleId('');
  };
  const open = async (target: PdfFileRecord) => {
    try {
      setProjects(await service.getProjects());
      setPdf(target);
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
    }
  };
  const pickProject = async (id: number) => {
    setProjectId(id);
    setArticleId('');
    try {
      setArticles((await service.getArticles(id)).filter((a) => !a.local_file_path));
    } catch (err) {
      console.error('Erro ao carregar artigos:', err);
    }
  };
  const confirm = async () => {
    if (!articleId || !pdf) return;
    try {
      await service.linkPdfToArticle(Number(articleId), pdf.file_path);
      close();
      onLinked();
    } catch (err) {
      onError('Erro ao vincular PDF: ' + err);
    }
  };
  return { pdf, projects, projectId, articles, articleId, setArticleId, open, pickProject, confirm, close };
}
