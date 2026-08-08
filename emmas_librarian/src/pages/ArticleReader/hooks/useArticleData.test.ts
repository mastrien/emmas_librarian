import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useArticleData } from './useArticleData';
import { projectService } from '../../../services/api';
import * as pdfTextSearch from '../../../utils/pdfTextSearch';

vi.mock('../../../services/api', () => ({
  projectService: {
    getArticle: vi.fn(),
    getProjectCategories: vi.fn(),
    getArticleCategories: vi.fn(),
    getHighlights: vi.fn(),
    getAnnotations: vi.fn(),
    getSetting: vi.fn(),
    getProjectWritingPad: vi.fn(),
    getPdfBuffer: vi.fn(),
    getPendingHighlights: vi.fn(),
    createHighlight: vi.fn(),
    deletePendingHighlight: vi.fn(),
    createAnnotation: vi.fn(),
    openPdfDialog: vi.fn(),
    uploadPdf: vi.fn(),
    unlinkPdf: vi.fn(),
  },
}));

vi.mock('../../../utils/pdfTextSearch', () => ({
  anchorPendingHighlights: vi.fn(),
}));

describe('useArticleData', () => {
  const setHighlights = vi.fn();
  const setStandaloneAnnotations = vi.fn();
  const setAnchoringStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', vi.fn());
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
  });

  it('initializes correctly', () => {
    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );
    expect(result.current.article).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.pdfUrl).toBe('');
  });

  it('fetches categories', async () => {
    (projectService.getProjectCategories as Mock).mockResolvedValue([{ id: 1, name: 'Cat 1' }]);
    (projectService.getArticleCategories as Mock).mockResolvedValue([1]);

    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );
    
    act(() => {
      // simulate article already fetched
      result.current.setArticle({ id: 1, project_id: 1 } as any);
    });

    await act(async () => {
      await result.current.fetchCategories();
    });

    expect(result.current.projectCategories).toEqual([{ id: 1, name: 'Cat 1' }]);
    expect(result.current.articleCategories).toEqual([1]);
  });

  it('fetches data correctly without local pdf', async () => {
    (projectService.getArticle as Mock).mockResolvedValue({
      id: 1, project_id: 10, ai_summary: JSON.stringify({ generalSummary: 'Gen', sectionSummary: 'Sec' }),
      local_file_path: null
    });
    (projectService.getHighlights as Mock).mockResolvedValue([{ id: 100, annotation_id: 200, position_data: {} }]);
    (projectService.getAnnotations as Mock).mockResolvedValue([{ id: 200 }, { id: 201 }]); // 200 is attached, 201 standalone
    (projectService.getSetting as Mock).mockResolvedValue('key');
    (projectService.getProjectWritingPad as Mock).mockResolvedValue('pad content');
    (projectService.getProjectCategories as Mock).mockResolvedValue([]);
    (projectService.getArticleCategories as Mock).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.fetchData();
    });

    expect(result.current.article?.id).toBe(1);
    expect(result.current.aiSummary).toEqual({ generalSummary: 'Gen', sectionSummary: 'Sec' });
    expect(result.current.writingPadContent).toBe('pad content');
    expect(result.current.hasAiKey).toBe(true);
    
    expect(setStandaloneAnnotations).toHaveBeenCalledWith([{ id: 201 }]); // 200 filtered out
    expect(setHighlights).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('fetches data and anchors pending highlights if pdf exists', async () => {
    (projectService.getArticle as Mock).mockResolvedValue({ id: 1, project_id: 10, local_file_path: '/path.pdf' });
    (projectService.getHighlights as Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 100, comment: 'C', annotation_id: 200 }]);
    (projectService.getAnnotations as Mock).mockResolvedValue([{ id: 200 }]);
    (projectService.getSetting as Mock).mockResolvedValue(null);
    (projectService.getProjectWritingPad as Mock).mockResolvedValue('');
    (projectService.getProjectCategories as Mock).mockResolvedValue([]);
    (projectService.getArticleCategories as Mock).mockResolvedValue([]);
    (projectService.getPdfBuffer as Mock).mockResolvedValue({ type: 'Buffer', data: [1, 2, 3] });
    (projectService.getPendingHighlights as Mock).mockResolvedValue([{ id: 999 }]);

    (pdfTextSearch.anchorPendingHighlights as Mock).mockResolvedValue({
      anchoredHighlights: [{ pendingId: 999, color: 'red', position: {}, content: {text: ''}, comment: {text: ''} }],
      unanchoredHighlights: [{ id: 888, comment: 'C', quote: 'Q' }]
    });

    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.fetchData();
    });

    expect(result.current.pdfUrl).toBe('emma-pdf://%2Fpath.pdf');
    expect(projectService.createHighlight).toHaveBeenCalled();
    expect(projectService.deletePendingHighlight).toHaveBeenCalledWith(999);
    expect(projectService.createAnnotation).toHaveBeenCalled();
    expect(projectService.deletePendingHighlight).toHaveBeenCalledWith(888);
  });

  it('handles error in anchorPendingHighlights', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (projectService.getArticle as Mock).mockResolvedValue({ id: 1, project_id: 10, local_file_path: '/path.pdf' });
    (projectService.getHighlights as Mock).mockResolvedValue([]);
    (projectService.getAnnotations as Mock).mockResolvedValue([]);
    (projectService.getSetting as Mock).mockResolvedValue(null);
    (projectService.getProjectWritingPad as Mock).mockResolvedValue('');
    (projectService.getProjectCategories as Mock).mockResolvedValue([]);
    (projectService.getArticleCategories as Mock).mockResolvedValue([]);
    (projectService.getPdfBuffer as Mock).mockResolvedValue(new ArrayBuffer(8));
    (projectService.getPendingHighlights as Mock).mockResolvedValue([{ id: 999 }]);

    (pdfTextSearch.anchorPendingHighlights as Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.fetchData();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('handles file upload', async () => {
    (projectService.openPdfDialog as Mock).mockResolvedValue('/new-path.pdf');
    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.handleFileUpload();
    });

    expect(projectService.uploadPdf).toHaveBeenCalledWith(1, '/new-path.pdf');
  });

  it('handles unlink pdf', async () => {
    (projectService.getArticle as Mock).mockResolvedValue({ id: 1, project_id: 10, local_file_path: '/path.pdf' });
    (projectService.getHighlights as Mock).mockResolvedValue([]);
    (projectService.getAnnotations as Mock).mockResolvedValue([]);
    (projectService.getSetting as Mock).mockResolvedValue(null);
    (projectService.getProjectWritingPad as Mock).mockResolvedValue('');
    (projectService.getProjectCategories as Mock).mockResolvedValue([]);
    (projectService.getArticleCategories as Mock).mockResolvedValue([]);
    (projectService.getPdfBuffer as Mock).mockResolvedValue(new ArrayBuffer(8));
    (projectService.getPendingHighlights as Mock).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.fetchData();
    });

    expect(result.current.pdfUrl).toBe('emma-pdf://%2Fpath.pdf'); // It was set

    (projectService.getArticle as Mock).mockResolvedValue({ id: 1, project_id: 10, local_file_path: null });

    await act(async () => {
      await result.current.handleUnlinkClick();
    });

    expect(projectService.unlinkPdf).toHaveBeenCalledWith(1);
    expect(result.current.pdfUrl).toBe('');
    expect(result.current.aiSummary).toBeNull();
  });

  it('does not unlink if not confirmed', async () => {
    vi.stubGlobal('confirm', () => false);
    
    (projectService.getArticle as Mock).mockResolvedValue({ id: 1, project_id: 10, local_file_path: '/path.pdf' });
    (projectService.getHighlights as Mock).mockResolvedValue([]);
    (projectService.getAnnotations as Mock).mockResolvedValue([]);
    (projectService.getSetting as Mock).mockResolvedValue(null);
    (projectService.getProjectWritingPad as Mock).mockResolvedValue('');
    (projectService.getProjectCategories as Mock).mockResolvedValue([]);
    (projectService.getArticleCategories as Mock).mockResolvedValue([]);
    (projectService.getPdfBuffer as Mock).mockResolvedValue(new ArrayBuffer(8));
    (projectService.getPendingHighlights as Mock).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.fetchData();
    });

    expect(result.current.pdfUrl).toBe('emma-pdf://%2Fpath.pdf');

    await act(async () => {
      await result.current.handleUnlinkClick();
    });

    expect(projectService.unlinkPdf).not.toHaveBeenCalled();
    expect(result.current.pdfUrl).toBe('emma-pdf://%2Fpath.pdf');
  });

  it('handles error in fetchData', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (projectService.getArticle as Mock).mockRejectedValue(new Error('fail'));
    
    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.fetchData();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('handles error in handleFileUpload', async () => {
    (projectService.openPdfDialog as Mock).mockResolvedValue('/new-path.pdf');
    (projectService.uploadPdf as Mock).mockRejectedValue(new Error('fail'));
    
    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.handleFileUpload();
    });

    expect(window.alert).toHaveBeenCalledWith('Erro ao vincular PDF');
  });

  it('handles error in handleUnlinkClick', async () => {
    (projectService.unlinkPdf as Mock).mockRejectedValue(new Error('fail'));
    
    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    act(() => {
      result.current.setArticle({ id: 1 } as any);
    });

    await act(async () => {
      await result.current.handleUnlinkClick();
    });

    expect(window.alert).toHaveBeenCalledWith('Erro ao desvincular o PDF');
  });

  it('handles error in fetchCategories', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (projectService.getProjectCategories as Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );
    
    act(() => {
      result.current.setArticle({ id: 1, project_id: 1 } as any);
    });

    await act(async () => {
      await result.current.fetchCategories();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('handles invalid json in ai_summary during fetchData', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (projectService.getArticle as Mock).mockResolvedValue({
      id: 1, project_id: 10, ai_summary: 'invalid json', local_file_path: null
    });
    (projectService.getHighlights as Mock).mockResolvedValue([]);
    (projectService.getAnnotations as Mock).mockResolvedValue([]);
    (projectService.getSetting as Mock).mockResolvedValue(null);
    (projectService.getProjectWritingPad as Mock).mockResolvedValue('');
    (projectService.getProjectCategories as Mock).mockResolvedValue([]);
    (projectService.getArticleCategories as Mock).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useArticleData('1', setHighlights, setStandaloneAnnotations, setAnchoringStatus)
    );

    await act(async () => {
      await result.current.fetchData();
    });

    expect(consoleError).toHaveBeenCalled();
    expect(result.current.aiSummary).toBeNull();
    consoleError.mockRestore();
  });
});
