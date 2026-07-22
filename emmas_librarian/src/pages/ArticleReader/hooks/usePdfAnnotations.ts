import { useState, useCallback } from 'react';
import { projectService } from '../../../services/api';
import type { Highlight, Annotation } from '../../../types';
type IHighlight = {
  position: unknown;
  color?: string;
  content?: { text?: string };
  comment: { text: string; emoji?: string };
};

export function usePdfAnnotations(id: string | undefined) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [standaloneAnnotations, setStandaloneAnnotations] = useState<Annotation[]>([]);
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [anchoringStatus, setAnchoringStatus] = useState<string>('');

  const addHighlight = async (highlight: IHighlight) => {
    if (!id) return;
    try {
      const response = await projectService.createHighlight(
        parseInt(id),
        highlight.color || 'yellow',
        highlight.position,
        highlight.content?.text || null,
        highlight.comment.text || undefined,
      );
      setHighlights([
        {
          id: response.id.toString(),
          article_id: parseInt(id),
          color: highlight.color || 'yellow',
          position_data: highlight.position,
          annotation_id: response.annotation_id || undefined,
          comment: highlight.comment.text || undefined,
          content_text: highlight.content?.text || undefined,
        },
        ...highlights,
      ]);
    } catch (err) {
      console.error('Erro ao salvar destaque', err);
    }
  };

  const handleCreateStandaloneAnnotation = async () => {
    if (!newAnnotationText.trim() || !id) return;
    try {
      const { id: annId } = await projectService.createAnnotation(parseInt(id), newAnnotationText);
      setStandaloneAnnotations([
        {
          id: annId,
          content_markdown: newAnnotationText,
          created_at: new Date().toISOString(),
          article_id: parseInt(id || '0'),
        },
        ...standaloneAnnotations,
      ]);
      setNewAnnotationText('');
    } catch (err) {
      console.error('Erro ao criar anotação avulsa', err);
    }
  };

  const handleDeleteHighlight = async (highlightId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja realmente excluir este destaque?')) {
      await projectService.deleteHighlight(parseInt(highlightId));
      setHighlights(highlights.filter((h) => h.id !== highlightId));
    }
  };

  const handleDeleteStandaloneAnnotation = async (annId: string) => {
    if (confirm('Deseja realmente excluir esta anotação?')) {
      await projectService.deleteAnnotation(parseInt(annId));
      setStandaloneAnnotations(standaloneAnnotations.filter((a) => a.id.toString() !== annId.toString()));
    }
  };

  const handleEditHighlightAnnotation = async (h: Highlight, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!h.annotation_id) {
      alert('Este destaque não possui uma anotação vinculada inicial. Crie um novo destaque com texto.');
      return;
    }
    setEditingId(h.id);
    setEditContent(h.comment || '');
  };

  const handleEditStandaloneAnnotation = async (a: Annotation) => {
    setEditingId(a.id.toString());
    setEditContent(a.content_markdown);
  };

  const saveEdit = async (idToSave: string, annotationId: number, isStandalone: boolean) => {
    try {
      await projectService.updateAnnotation(annotationId, editContent);
      if (isStandalone) {
        setStandaloneAnnotations(
          standaloneAnnotations.map((x) =>
            x.id.toString() === idToSave ? { ...x, content_markdown: editContent } : x,
          ),
        );
      } else {
        setHighlights(highlights.map((x) => (x.id === idToSave ? { ...x, comment: editContent } : x)));
      }
      setEditingId(null);
      setEditContent('');
    } catch (e) {
      console.error('Erro ao salvar edição', e);
      alert('Erro ao salvar edição.');
    }
  };

  return {
    highlights,
    setHighlights,
    standaloneAnnotations,
    setStandaloneAnnotations,
    newAnnotationText,
    setNewAnnotationText,
    editingId,
    setEditingId,
    editContent,
    setEditContent,
    anchoringStatus,
    setAnchoringStatus,
    addHighlight,
    handleCreateStandaloneAnnotation,
    handleDeleteHighlight,
    handleDeleteStandaloneAnnotation,
    handleEditHighlightAnnotation,
    handleEditStandaloneAnnotation,
    saveEdit,
  };
}
