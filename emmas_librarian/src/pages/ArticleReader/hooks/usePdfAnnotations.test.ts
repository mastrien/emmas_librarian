import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { usePdfAnnotations } from './usePdfAnnotations';
import { projectService } from '../../../services/api';
import { Annotation } from '../../../types';
import type { ViewerHighlight } from '../viewerHighlight';

/** A highlight in the shape the viewer reads (see viewerHighlight.ts). */
const viewerHighlight = (overrides: Partial<ViewerHighlight> = {}): ViewerHighlight => ({
  id: '99',
  article_id: 1,
  position: { pageNumber: 1 },
  content: { text: 'Quote' },
  comment: { text: '', emoji: '' },
  color: 'yellow',
  ...overrides,
});

vi.mock('../../../services/api', async () => {
  const { FakeProjectService } = await import('../../../services/__tests__/fakes/FakeProjectService');
  return { projectService: FakeProjectService.create() };
});

describe('usePdfAnnotations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', vi.fn());
  });

  it('adds a highlight and keeps it in the shape the PDF viewer reads', async () => {
    (projectService.createHighlight as Mock).mockResolvedValue({ id: 99, annotation_id: -1 });
    (projectService.getHighlights as Mock).mockResolvedValue([
      {
        id: '99',
        article_id: 1,
        color: 'red',
        position_data: { page: 1 },
        content_text: 'Some text',
        comment: 'My comment',
        annotation_id: 100,
      },
    ]);

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
    // Regression: the new highlight used to be stored as a DB row (position_data), crashing the viewer.
    expect(result.current.highlights).toEqual([
      {
        id: '99',
        article_id: 1,
        color: 'red',
        position: { page: 1 },
        content: { text: 'Some text' },
        comment: { text: 'My comment', emoji: '' },
        annotation_id: 100,
      },
    ]);
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
      result.current.setHighlights([viewerHighlight()]);
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
      result.current.setHighlights([viewerHighlight()]);
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
    const highlight = viewerHighlight({ annotation_id: 100, comment: { text: 'Old text', emoji: '' } });

    await act(async () => {
      await result.current.handleEditHighlightAnnotation(highlight, {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    expect(result.current.editingId).toBe('99');
    expect(result.current.editContent).toBe('Old text');
  });

  it('alerts if highlight has no annotation_id on edit', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    const highlight = viewerHighlight({ comment: { text: 'Old text', emoji: '' } }); // no annotation_id

    await act(async () => {
      await result.current.handleEditHighlightAnnotation(highlight, {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    expect(window.alert).toHaveBeenCalledWith(
      'Este destaque não possui uma anotação vinculada inicial. Crie um novo destaque com texto.',
    );
    expect(result.current.editingId).toBeNull();
  });

  it('edits highlight annotation with empty comment', async () => {
    const { result } = renderHook(() => usePdfAnnotations('1'));
    const highlight = viewerHighlight({ annotation_id: 100 }); // empty comment

    await act(async () => {
      await result.current.handleEditHighlightAnnotation(highlight, {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent);
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
        { id: 201, content_markdown: 'Untouched', article_id: 1, created_at: '' },
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
      result.current.setHighlights([
        viewerHighlight({ comment: { text: 'Old', emoji: '' } }),
        viewerHighlight({ id: '100', comment: { text: 'Untouched', emoji: '' } }),
      ]);
      result.current.setEditingId('99');
      result.current.setEditContent('New');
    });

    await act(async () => {
      await result.current.saveEdit('99', 100, false);
    });

    expect(projectService.updateAnnotation).toHaveBeenCalledWith(100, 'New');
    // The note stays an object: a plain string here also broke the viewer.
    expect(result.current.highlights[0].comment).toEqual({ text: 'New', emoji: '' });
    expect(result.current.highlights[1].comment.text).toBe('Untouched');
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
