import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MassCitationModal } from '../modals/MassCitationModal';
import { projectService } from '../../services/api';
import { generateCitation } from '../../services/citationService';

// Mock api service
vi.mock('../../services/api', () => ({
  projectService: {
    updateArticleMetadata: vi.fn(() => Promise.resolve())
  }
}));

// Mock citationService
vi.mock('../../services/citationService', () => ({
  generateCitation: vi.fn((art, style, format, useEtAl) => {
    const etAlSuffix = useEtAl === false ? '-noetal' : '';
    return `[${style}-${format}${etAlSuffix}] ${art.authors} - ${art.title} (${art.year})`;
  })
}));

describe('MassCitationModal', () => {
  const mockArticles = [
    {
      id: 1,
      project_id: 1,
      title: 'Alpha Article',
      authors: 'Zeta, Z.',
      year: 2021,
      journal: 'Journal of Testing',
      doi: '10.1000/zeta',
      pages: '1-10',
      csl_json: JSON.stringify({
        title: 'Alpha Article',
        author: [{ family: 'Zeta', given: 'Z.' }],
        issued: { 'date-parts': [[2021]] }
      }),
      status: 'read' as const
    },
    {
      id: 2,
      project_id: 1,
      title: 'Beta Article',
      authors: 'Alpha, A.',
      year: 2020,
      journal: 'Vite Studies',
      doi: '10.1000/alpha',
      pages: '20-30',
      csl_json: '{}',
      status: 'read' as const
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<MassCitationModal isOpen={false} onClose={vi.fn()} articles={mockArticles} />);
    expect(screen.queryByText('Citação em Massa (Artigos Lidos)')).toBeNull();
  });

  it('renders correctly and lists citations', () => {
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={mockArticles} />);
    expect(screen.getByText('Citação em Massa (Artigos Lidos)')).toBeDefined();
    
    const items = screen.getAllByText(/Article/);
    expect(items).toHaveLength(2);
  });

  it('changes style and format filters and updates output', () => {
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={mockArticles} />);
    
    // Change style to APA
    const styleSelect = document.body.querySelector('select') as HTMLSelectElement;
    expect(styleSelect).toBeDefined();
    fireEvent.change(styleSelect, { target: { value: 'apa' } });
    expect(styleSelect.value).toBe('apa');

    // Change format to text
    const textBtn = screen.getByText('Texto');
    fireEvent.click(textBtn);
    
    // Verify generateCitation is called with proper arguments including default useEtAl=true
    expect(generateCitation).toHaveBeenCalledWith(expect.any(Object), 'apa', 'text', true);
  });

  it('toggles the et al checkbox and updates output', () => {
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={mockArticles} />);
    
    const etAlCheckbox = screen.getByLabelText(/Usar "et al\."/) as HTMLInputElement;
    expect(etAlCheckbox.checked).toBe(true);
    
    fireEvent.click(etAlCheckbox);
    expect(etAlCheckbox.checked).toBe(false);
    
    // Verify generateCitation is called with useEtAl = false
    expect(generateCitation).toHaveBeenCalledWith(expect.any(Object), expect.any(String), expect.any(String), false);
  });

  it('sorts alphabetically and chronologically', () => {
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={mockArticles} />);
    
    // The second select in controls is the sort filter
    const selects = document.body.querySelectorAll('select');
    const sortSelect = selects[1] as HTMLSelectElement;
    expect(sortSelect).toBeDefined();
    expect(sortSelect.value).toBe('author'); // default sort is author
    
    // Switch to chronological (year)
    fireEvent.change(sortSelect, { target: { value: 'year' } });
    expect(sortSelect.value).toBe('year');
  });

  it('allows inline editing of metadata and updates state', async () => {
    const onArticlesUpdatedMock = vi.fn();
    render(
      <MassCitationModal isOpen={true} onClose={vi.fn()} articles={mockArticles} onArticlesUpdated={onArticlesUpdatedMock} />
    );

    // Click edit on the first item (Beta Article is first under author sort)
    const editBtns = screen.getAllByText('Editar');
    fireEvent.click(editBtns[0]);

    // Form inputs should be visible
    expect(screen.getByText('Editar Metadados da Citação')).toBeDefined();

    const titleInput = document.body.querySelector('input[name="title"]') as HTMLInputElement;
    expect(titleInput).toBeDefined();
    expect(titleInput.value).toBe('Beta Article');
    fireEvent.change(titleInput, { target: { value: 'Beta Article Modified' } });

    const saveBtn = screen.getByText('Salvar Alterações');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(projectService.updateArticleMetadata).toHaveBeenCalledWith(2, expect.objectContaining({
        title: 'Beta Article Modified'
      }));
      expect(onArticlesUpdatedMock).toHaveBeenCalled();
    });
  });

  it('resets metadata based on CSL JSON if reset button is clicked', async () => {
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={mockArticles} />);

    // Click edit on the second item (Alpha Article is second under author sort)
    const editBtns = screen.getAllByText('Editar');
    fireEvent.click(editBtns[1]);

    const titleInput = document.body.querySelector('input[name="title"]') as HTMLInputElement;
    expect(titleInput).toBeDefined();
    expect(titleInput.value).toBe('Alpha Article');
    
    // Overwrite title in form
    fireEvent.change(titleInput, { target: { value: 'Some modified title' } });
    expect(titleInput.value).toBe('Some modified title');

    // Click reset
    const resetBtn = screen.getByText('Resetar');
    fireEvent.click(resetBtn);

    // Verify title restored to 'Alpha Article' (from CSL json)
    expect(titleInput.value).toBe('Alpha Article');
  });
});
