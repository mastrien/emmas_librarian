import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { usePdfAnnotations } from './usePdfAnnotations';
import { projectService } from '../../../services/api';
import { Highlight, Annotation } from '../../../types';

vi.mock('../../../services/api', () => ({
  projectService: {
    createHighlight: vi.fn(),
    createAnnotation: vi.fn(),
    deleteHighlight: vi.fn(),
    deleteAnnotation: vi.fn(),
    updateAnnotation: vi.fn(),
  },
}));

describe('usePdfAnnotations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', vi.fn());
  });

  it('adds a highlight successfully', async () => {
    (projectService.createHighlight as Mock).mockResolvedValue({
      id: 99,
      annotation_id: 100,
    });

    const { result } = renderHook(() => usePdfAnnotations('1'));

    await act(async () => {
      await result.current.addHighlight({
        position: { page: 1 },
        color: 'red',
        content: { text: 'Some text' },
        comment: { text: 'My comment' },
      });
    });

    expect(projectService.createHighlight).toHaveBeenCalledWith(1, 'red', { page: 1 }, 'Some text', 'My comment');
    expect(result.current.highlights).toHaveLength(1);
    expect(result.current.highlights[0].id).toBe('99');
    expect(result.current.highlights[0].color).toBe('red');
  });

  it('creates standalone annotation', async () => {
    (projectService.createAnnotation as Mock).mockResolvedValue({ id: 200 });
    const { result } = renderHook(() => usePdfAnnotations('1'));

    act(() => {
      result.current.setNewAnnotationText('Avulsa');
    });

    await act(async () => {
      await result.current.handleCreateStandaloneAnnotation();
    });

    expect(projectService.createAnnotation).toHaveBeenCalledWith(1, 'Avulsa');
    expect(result.current.standaloneAnnotations).toHaveLength(1);
    expect(result.current.standaloneAnnotations[0].id).toBe(200);
    expect(result.current.newAnnotationText).toBe('');
  });

  it('ignores empty standalone annotation text', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));

    act(() => {
      result.current.setNewAnnotationText('   ');
    });

    await act(async () => {
      await result.current.handleCreateStandaloneAnnotation();
    });

    expect(projectService.createAnnotation).not.toHaveBeenCalled();
  });

  it('deletes highlight if confirmed', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    act(() => {
      result.current.setHighlights([{ id: '99' } as Highlight]);
    });

    await act(async () => {
      await result.current.handleDeleteHighlight('99', { stopPropagation: vi.fn() } as unknown as React.MouseEvent);
    });

    expect(projectService.deleteHighlight).toHaveBeenCalledWith(99);
    expect(result.current.highlights).toHaveLength(0);
  });

  it('does not delete highlight if not confirmed', async () => {
    vi.stubGlobal('confirm', () => false);
    const { result } = renderHook(() => usePdfAnnotations('1'));
    act(() => {
      result.current.setHighlights([{ id: '99' } as Highlight]);
    });

    await act(async () => {
      await result.current.handleDeleteHighlight('99', { stopPropagation: vi.fn() } as unknown as React.MouseEvent);
    });

    expect(projectService.deleteHighlight).not.toHaveBeenCalled();
    expect(result.current.highlights).toHaveLength(1);
  });

  it('deletes standalone annotation', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    act(() => {
      result.current.setStandaloneAnnotations([{ id: 200, content_markdown: '' } as Annotation]);
    });

    await act(async () => {
      await result.current.handleDeleteStandaloneAnnotation('200');
    });

    expect(projectService.deleteAnnotation).toHaveBeenCalledWith(200);
    expect(result.current.standaloneAnnotations).toHaveLength(0);
  });

  it('edits highlight annotation', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    const highlight = { id: '99', annotation_id: 100, comment: 'Old text' } as Highlight;

    await act(async () => {
      await result.current.handleEditHighlightAnnotation(highlight, { stopPropagation: vi.fn() } as unknown as React.MouseEvent);
    });

    expect(result.current.editingId).toBe('99');
    expect(result.current.editContent).toBe('Old text');
  });

  it('alerts if highlight has no annotation_id on edit', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    const highlight = { id: '99', comment: 'Old text' } as Highlight; // no annotation_id

    await act(async () => {
      await result.current.handleEditHighlightAnnotation(highlight, { stopPropagation: vi.fn() } as unknown as React.MouseEvent);
    });

    expect(window.alert).toHaveBeenCalledWith('Este destaque não possui uma anotação vinculada inicial. Crie um novo destaque com texto.');
    expect(result.current.editingId).toBeNull();
  });

  it('edits highlight annotation with empty comment', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    const highlight = { id: '99', annotation_id: 100 } as Highlight; // no comment

    await act(async () => {
      await result.current.handleEditHighlightAnnotation(highlight, { stopPropagation: vi.fn() } as unknown as React.MouseEvent);
    });

    expect(result.current.editingId).toBe('99');
    expect(result.current.editContent).toBe('');
  });

  it('edits standalone annotation', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    const annotation = { id: 200, content_markdown: 'Markdown' } as Annotation;

    await act(async () => {
      await result.current.handleEditStandaloneAnnotation(annotation);
    });

    expect(result.current.editingId).toBe('200');
    expect(result.current.editContent).toBe('Markdown');
  });

  it('saves edit for standalone', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    act(() => {
      result.current.setStandaloneAnnotations([{ id: 200, content_markdown: 'Old', article_id: 1, created_at: '' }]);
      result.current.setEditingId('200');
      result.current.setEditContent('New');
    });

    await act(async () => {
      await result.current.saveEdit('200', 200, true);
    });

    expect(projectService.updateAnnotation).toHaveBeenCalledWith(200, 'New');
    expect(result.current.standaloneAnnotations[0].content_markdown).toBe('New');
    expect(result.current.editingId).toBeNull();
    expect(result.current.editContent).toBe('');
  });

  it('saves edit for standalone, leaving others intact', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    act(() => {
      result.current.setStandaloneAnnotations([
        { id: 200, content_markdown: 'Old', article_id: 1, created_at: '' },
        { id: 201, content_markdown: 'Untouched', article_id: 1, created_at: '' }
      ]);
      result.current.setEditingId('200');
      result.current.setEditContent('New');
    });

    await act(async () => {
      await result.current.saveEdit('200', 200, true);
    });

    expect(projectService.updateAnnotation).toHaveBeenCalledWith(200, 'New');
    expect(result.current.standaloneAnnotations[0].content_markdown).toBe('New');
    expect(result.current.standaloneAnnotations[1].content_markdown).toBe('Untouched');
    expect(result.current.editingId).toBeNull();
    expect(result.current.editContent).toBe('');
  });

  it('saves edit for highlight, leaving others intact', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    act(() => {
      result.current.setHighlights([{ id: '99', comment: 'Old', article_id: 1 } as Highlight]);
      result.current.setEditingId('99');
      result.current.setEditContent('New');
    });

    await act(async () => {
      await result.current.saveEdit('99', 100, false);
    });

    expect(projectService.updateAnnotation).toHaveBeenCalledWith(100, 'New');
    expect(result.current.highlights[0].comment).toBe('New');
    expect(result.current.editingId).toBeNull();
  });

  it('handles error in saveEdit', async () => {
    (projectService.updateAnnotation as Mock).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => usePdfAnnotations('1'));

    await act(async () => {
      await result.current.saveEdit('99', 100, false);
    });

    expect(window.alert).toHaveBeenCalledWith('Erro ao salvar edição.');
  });

  it('handles error in addHighlight', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (projectService.createHighlight as Mock).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => usePdfAnnotations('1'));

    await act(async () => {
      await result.current.addHighlight({ position: {}, comment: { text: '' } });
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('handles error in handleCreateStandaloneAnnotation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (projectService.createAnnotation as Mock).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => usePdfAnnotations('1'));

    act(() => {
      result.current.setNewAnnotationText('Test error');
    });

    await act(async () => {
      await result.current.handleCreateStandaloneAnnotation();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
