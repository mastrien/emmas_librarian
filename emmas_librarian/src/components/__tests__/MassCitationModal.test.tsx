// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MassCitationModal } from '../modals/MassCitationModal';
import { generateCitation } from '../../services/citationService';

// Mock api service
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {}
}));

// Mock citationService — keep parseAuthors real so sort-by-last-name logic works
vi.mock('../../services/citationService', async (importActual) => {
  const actual = await importActual<typeof import('../../services/citationService')>();
  return {
    ...actual,
    generateCitation: vi.fn((art: unknown, style: string, format: string, useEtAl: boolean) => {
      const etAlSuffix = useEtAl === false ? '-noetal' : '';
      return `[${style}-${format}${etAlSuffix}] ${art.authors} - ${art.title} (${art.year})`;
    }),
  };
});

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
        issued: { 'date-parts': [[2021]] },
      }),
      status: 'read' as const,
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
      status: 'read' as const,
    },
  ];

  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
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

  it('sorts by last name (family) of first author, not first name', () => {
    // mockArticles: id=1 has family='Zeta', id=2 has family='Alpha'
    // Alphabetical by surname: Alpha (id=2) should come before Zeta (id=1)
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={mockArticles} />);

    const citations = screen.getAllByText(/Article/);
    // First rendered item should mention 'Beta Article' (Alpha surname) and second 'Alpha Article' (Zeta surname)
    expect(citations[0].textContent).toContain('Beta Article');
    expect(citations[1].textContent).toContain('Alpha Article');
  });

  it('sorts correctly when authors are in "Given Family" format separated by semicolons', () => {
    const articles = [
      { id: 10, project_id: 1, title: 'Primeiro', authors: 'Carlos Zimmer', year: 2020, status: 'read' as const },
      { id: 11, project_id: 1, title: 'Segundo', authors: 'Ana Alves', year: 2021, status: 'read' as const },
      { id: 12, project_id: 1, title: 'Terceiro', authors: 'Bruno Melo', year: 2019, status: 'read' as const },
    ];
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={articles} />);

    // Expected order by surname: Alves < Melo < Zimmer → Segundo, Terceiro, Primeiro
    // Use getAllByText with substring match since the mock wraps text in a span
    const allItems = screen.getAllByText(/Alves|Melo|Zimmer/);
    const titles = allItems.map((el) => el.textContent || '');
    // The text returned by the mock includes surname, so Alves comes first, then Melo, then Zimmer
    expect(titles[0]).toContain('Alves');
    expect(titles[1]).toContain('Melo');
    expect(titles[2]).toContain('Zimmer');
  });

  it('sorts correctly when authors are in "Family, Given" format', () => {
    const articles = [
      { id: 20, project_id: 1, title: 'Art X', authors: 'Souza, Pedro', year: 2022, status: 'read' as const },
      { id: 21, project_id: 1, title: 'Art Y', authors: 'Abreu, Carla', year: 2023, status: 'read' as const },
      { id: 22, project_id: 1, title: 'Art Z', authors: 'Lima, Roberto', year: 2021, status: 'read' as const },
    ];
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={articles} />);

    // Expected order by surname: Abreu < Lima < Souza → Art Y, Art Z, Art X
    const allCitations = screen.getAllByText(/Art [XYZ]/);
    expect(allCitations[0].textContent).toContain('Art Y'); // Abreu
    expect(allCitations[1].textContent).toContain('Art Z'); // Lima
    expect(allCitations[2].textContent).toContain('Art X'); // Souza
  });

  it('does NOT sort by first name — "Ana Zimmer" comes after "Carlos Alves" by surname', () => {
    // If sorting by first name: Ana < Carlos → Ana first (WRONG)
    // If sorting by surname:   Alves < Zimmer → Carlos first (CORRECT)
    const articles = [
      { id: 30, project_id: 1, title: 'Wrong if first', authors: 'Ana Zimmer', year: 2020, status: 'read' as const },
      { id: 31, project_id: 1, title: 'Wrong if last', authors: 'Carlos Alves', year: 2021, status: 'read' as const },
    ];
    render(<MassCitationModal isOpen={true} onClose={vi.fn()} articles={articles} />);

    const citations = screen.getAllByText(/Wrong if/);
    // Surname order: Alves (Carlos) < Zimmer (Ana) → 'Wrong if last' first
    expect(citations[0].textContent).toContain('Wrong if last'); // Carlos Alves → Alves
    expect(citations[1].textContent).toContain('Wrong if first'); // Ana Zimmer   → Zimmer
  });

  it('allows inline editing of metadata and updates state', async () => {
    const onArticlesUpdatedMock = vi.fn();
    render(
      <MassCitationModal
        isOpen={true}
        onClose={vi.fn()}
        articles={mockArticles}
        onArticlesUpdated={onArticlesUpdatedMock}
      />,
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
      expect(fakeService.updateArticleMetadata).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          title: 'Beta Article Modified',
        }),
      );
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
