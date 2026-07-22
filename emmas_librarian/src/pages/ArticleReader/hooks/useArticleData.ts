import { useState, useCallback } from 'react';
import { projectService } from '../../../services/api';
import type { Article, Highlight, Annotation, ProjectCategory, ArticleCategory } from '../../../types';
import { anchorPendingHighlights } from '../../../utils/pdfTextSearch';

export function useArticleData(
  id: string | undefined,
  setHighlights: (h: unknown[]) => void,
  setStandaloneAnnotations: (a: Annotation[]) => void,
  setAnchoringStatus: (s: string) => void,
) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
  const [articleCategories, setArticleCategories] = useState<ArticleCategory[]>([]);
  const [writingPadContent, setWritingPadContent] = useState('');
  const [aiSummary, setAiSummary] = useState<{ generalSummary: string; sectionSummary: string } | null>(null);
  const [hasAiKey, setHasAiKey] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!id || !article) return;
    try {
      const [pCats, aCats] = await Promise.all([
        projectService.getProjectCategories(article.project_id),
        projectService.getArticleCategories(parseInt(id)),
      ]);
      setProjectCategories(pCats);
      setArticleCategories(aCats);
    } catch (err) {
      console.error('Erro ao carregar categorias dinâmicas', err);
    }
  }, [id, article]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const artData = await projectService.getArticle(parseInt(id));

      const [highData, annData, openai, gemini, anthropic, ollama, padContent, pCats, aCats] = await Promise.all([
        projectService.getHighlights(parseInt(id)),
        projectService.getAnnotations(parseInt(id)),
        projectService.getSetting('api_key_openai'),
        projectService.getSetting('api_key_gemini'),
        projectService.getSetting('api_key_anthropic'),
        projectService.getSetting('api_key_ollama'),
        projectService.getProjectWritingPad(artData.project_id),
        projectService.getProjectCategories(artData.project_id),
        projectService.getArticleCategories(parseInt(id)),
      ]);
      setArticle(artData);
      setHasAiKey(!!(openai || gemini || anthropic || ollama));
      setProjectCategories(pCats);
      setArticleCategories(aCats);

      if (artData.ai_summary) {
        try {
          const parsed = JSON.parse(artData.ai_summary);
          setAiSummary({
            generalSummary: parsed.generalSummary?.replace(/\\n/g, '\n') || '',
            sectionSummary: parsed.sectionSummary?.replace(/\\n/g, '\n') || '',
          });
        } catch (e) {
          console.error('Falha ao carregar o resumo de IA do cache:', e);
        }
      } else {
        setAiSummary(null);
      }

      if (padContent !== null && padContent !== undefined) {
        setWritingPadContent(padContent);
      }

      const attachedAnnIds = new Set(highData.map((h: Highlight) => h.annotation_id));
      setStandaloneAnnotations(annData.filter((a: Annotation) => !attachedAnnIds.has(a.id)));

      setHighlights(
        highData.map((h: Highlight) => ({
          id: h.id.toString(),
          position: h.position_data,
          content: { text: (h as unknown as Record<string, unknown>).content_text || h.comment || '' },
          comment: { text: h.comment || '', emoji: '' },
          color: h.color || 'yellow',
          annotation_id: h.annotation_id,
          article_id: h.article_id,
        })),
      );

      if (artData.local_file_path) {
        const buffer = (await projectService.getPdfBuffer(parseInt(id))) as
          | { type?: string; data?: Iterable<number> }
          | ArrayBuffer;
        let uint8Array: Uint8Array;

        // Handle Electron IPC buffer serialization
        if (
          buffer &&
          typeof buffer === 'object' &&
          'type' in buffer &&
          buffer.type === 'Buffer' &&
          'data' in buffer &&
          buffer.data
        ) {
          uint8Array = new Uint8Array(buffer.data);
        } else {
          uint8Array = new Uint8Array(buffer as ArrayBuffer);
        }

        const blob = new Blob([uint8Array as any], { type: 'application/pdf' });
        const localUrl = URL.createObjectURL(blob);
        setPdfUrl(localUrl);

        // Process pending highlights asynchronously
        const pendings = await projectService.getPendingHighlights(parseInt(id));
        if (pendings && pendings.length > 0) {
          try {
            const { anchoredHighlights, unanchoredHighlights } = await anchorPendingHighlights(
              localUrl,
              pendings,
              setAnchoringStatus,
            );
            if (anchoredHighlights && anchoredHighlights.length > 0) {
              for (const anchor of anchoredHighlights) {
                await projectService.createHighlight(
                  parseInt(id),
                  anchor.color,
                  anchor.position,
                  anchor.content.text,
                  anchor.comment.text,
                );
                await projectService.deletePendingHighlight(anchor.pendingId);
              }
              // Refresh highlights after saving
              const newHighData = await projectService.getHighlights(parseInt(id));
              setHighlights(
                newHighData.map((h: Highlight) => ({
                  id: h.id.toString(),
                  position: h.position_data,
                  content: { text: (h as unknown as Record<string, unknown>).content_text || h.comment || '' },
                  comment: { text: h.comment || '', emoji: '' },
                  color: h.color || 'yellow',
                  annotation_id: h.annotation_id,
                  article_id: h.article_id,
                })),
              );
            }
            // If some couldn't be anchored, create standalone annotations so they aren't lost
            if (unanchoredHighlights && unanchoredHighlights.length > 0) {
              for (const unanchored of unanchoredHighlights) {
                const markdown = `[Destaque não ancorado]\n\nComentário: ${unanchored.comment}\n\nCitação no texto: "${unanchored.quote}"`;
                await projectService.createAnnotation(parseInt(id), markdown);
                await projectService.deletePendingHighlight(unanchored.id);
              }
              // Refresh standalone annotations
              const newAnnData = await projectService.getAnnotations(parseInt(id));
              const currentHighData = await projectService.getHighlights(parseInt(id));
              const currentAttachedAnnIds = new Set(currentHighData.map((h: Highlight) => h.annotation_id));
              setStandaloneAnnotations(newAnnData.filter((a: Annotation) => !currentAttachedAnnIds.has(a.id)));
            }
          } catch (e) {
            console.error('Failed to anchor highlights:', e);
          } finally {
            setAnchoringStatus('');
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar artigo', err);
    } finally {
      setLoading(false);
    }
  }, [id, setHighlights, setStandaloneAnnotations, setAnchoringStatus]);

  const handleFileUpload = async () => {
    if (!id) return;
    setUploading(true);
    try {
      const filePath = await projectService.openPdfDialog();
      if (filePath) {
        await projectService.uploadPdf(parseInt(id), filePath);
        await fetchData();
      }
    } catch (err) {
      alert('Erro ao vincular PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleUnlinkClick = async () => {
    if (!id || !article) return;
    if (
      window.confirm(
        'Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.',
      )
    ) {
      try {
        await projectService.unlinkPdf(parseInt(id));
        setPdfUrl('');
        setAiSummary(null);
        await fetchData();
      } catch (err) {
        alert('Erro ao desvincular o PDF');
      }
    }
  };

  return {
    article,
    setArticle,
    loading,
    uploading,
    pdfUrl,
    projectCategories,
    articleCategories,
    writingPadContent,
    setWritingPadContent,
    aiSummary,
    setAiSummary,
    hasAiKey,
    fetchData,
    fetchCategories,
    handleFileUpload,
    handleUnlinkClick,
  };
}
