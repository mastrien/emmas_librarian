import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchPage } from '../SearchPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as any),
    useNavigate: () => mockNavigate,
  };
});

// Mock child components
vi.mock('../../components/common/QueryBuilder', () => ({
  QueryBuilder: ({ onChange }: any) => (
    <div data-testid="mock-query-builder">
      <button
        type="button"
        onClick={() => onChange({ type: 'rule', field: 'title', operator: 'contains', value: 'test' })}
      >
        Change Query
      </button>
    </div>
  ),
}));

vi.mock('../../components/modals/SearchSummaryModal', () => ({
  SearchSummaryModal: ({
    onSave,
    onDiscard,
    saveError,
  }: {
    onSave: () => void;
    onDiscard: () => void;
    saveError?: string | null;
  }) => (
    <div data-testid="mock-summary-modal">
      Summary Modal {saveError}
      <button onClick={onSave}>Save Results</button>
      <button onClick={onDiscard}>Discard Results</button>
    </div>
  ),
}));

describe('SearchPage', () => {
  let fakeService: FakeProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeService = FakeProjectService.create();

    fakeService.getProject.mockResolvedValue({ id: 1, name: 'Test Project', created_at: '' });
    fakeService.getSetting.mockImplementation(async (key: string) => {
      if (key === 'scopus_api_key') return 'mock-scopus-key';
      if (key === 'wos_api_key') return 'mock-wos-key';
      return null;
    });
    fakeService.translateQuery.mockResolvedValue({
      openalex: { isValid: true, query: 'openalex-query' },
      crossref: { isValid: true, query: 'crossref-query' },
      scopus: { isValid: true, query: 'scopus-query', warning: 'Aviso scopus' },
      wos: { isValid: false, query: '', error: 'Erro de sintaxe wos' },
    });
    fakeService.previewSearch.mockResolvedValue({
      previewId: 'preview-1',
      breakdown: { openalex: { count: 10 } },
      results: [],
    });
  });

  const renderPage = (projectId = '1') => {
    return render(
      <ServicesProvider apiService={fakeService}>
        <MemoryRouter initialEntries={[`/projects/${projectId}/search`]}>
          <Routes>
            <Route path="/projects/:id/search" element={<SearchPage />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>,
    );
  };

  it('renders project name and loads initial databases', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument();
    });

    expect(screen.getAllByText('OpenAlex').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Crossref').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Scopus').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Web of Science').length).toBeGreaterThan(0);
  });

  it('handles database toggling and API key alert', async () => {
    fakeService.getSetting.mockResolvedValue(null);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument();
    });

    const scopusBtn = screen.getByRole('button', { name: /Scopus/i });
    await act(async () => {
      fireEvent.click(scopusBtn);
    });

    expect(screen.getByText('Chave de API Necessária')).toBeInTheDocument();
    expect(screen.getByText(/Para realizar buscas na/)).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancelar');
    await act(async () => {
      fireEvent.click(cancelBtn);
    });
    expect(screen.queryByText('Chave de API Necessária')).not.toBeInTheDocument();
  });

  it('navigates to settings from key alert', async () => {
    fakeService.getSetting.mockResolvedValue(null);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument();
    });

    const wosBtn = screen.getByRole('button', { name: /Web of Science/i });
    await act(async () => {
      fireEvent.click(wosBtn);
    });

    const configBtn = screen.getByText('Configurações');
    await act(async () => {
      fireEvent.click(configBtn);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('handles query translation and custom queries', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('openalex-query')).toBeInTheDocument();
    });

    expect(screen.getByText('Erro de sintaxe wos')).toBeInTheDocument();
    expect(screen.getByText('Aviso scopus')).toBeInTheDocument();

    const customBtns = screen.getAllByRole('button', { name: /Substituir por Query Customizada/i });
    const customBtn = customBtns[0];
    if (customBtn) {
      await act(async () => {
        fireEvent.click(customBtn);
      });
    }

    const textarea = screen.getByPlaceholderText(/Digite a query exata/);
    expect(textarea).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'my-custom-query' } });
    });
    expect(textarea).toHaveValue('my-custom-query');

    const restoreBtn = screen.getByText(/Restaurar Tradução Automática/);
    await act(async () => {
      fireEvent.click(restoreBtn);
    });
    expect(screen.queryByPlaceholderText(/Digite a query exata/)).not.toBeInTheDocument();
  });

  const runSearchWithWos = async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Web of Science/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Fazer Busca/i }));
    });
  };

  it('shows the results for review without saving them', async () => {
    await runSearchWithWos();

    expect(fakeService.previewSearch).toHaveBeenCalled();
    expect(screen.getByTestId('mock-summary-modal')).toBeInTheDocument();
    expect(fakeService.saveSearchPreview).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('saves the reviewed results and goes back to the project', async () => {
    await runSearchWithWos();

    await act(async () => {
      fireEvent.click(screen.getByText('Save Results'));
    });

    expect(fakeService.saveSearchPreview).toHaveBeenCalledWith('preview-1');
    expect(mockNavigate).toHaveBeenCalledWith('/projects/1');
  });

  it('discards the results and stays on the search page to refine the query', async () => {
    await runSearchWithWos();

    await act(async () => {
      fireEvent.click(screen.getByText('Discard Results'));
    });

    expect(fakeService.discardSearchPreview).toHaveBeenCalledWith('preview-1');
    expect(screen.queryByTestId('mock-summary-modal')).not.toBeInTheDocument();
    expect(fakeService.saveSearchPreview).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps the review open and explains when saving fails', async () => {
    fakeService.saveSearchPreview.mockRejectedValue(new Error('disco cheio'));
    await runSearchWithWos();

    await act(async () => {
      fireEvent.click(screen.getByText('Save Results'));
    });

    expect(screen.getByTestId('mock-summary-modal')).toHaveTextContent('disco cheio');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles search error', async () => {
    fakeService.previewSearch.mockRejectedValue(new Error('Search failed horribly'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument();
    });

    const wosBtn = screen.getByRole('button', { name: /Web of Science/i });
    await act(async () => {
      fireEvent.click(wosBtn);
    });

    const searchBtn = screen.getByRole('button', { name: /Fazer Busca/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(screen.getByText('Search failed horribly')).toBeInTheDocument();
  });

  it('prevents search if invalid translation and no custom query', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument();
    });

    const searchBtn = screen.getByRole('button', { name: /Fazer Busca/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(screen.getByText(/A busca automática falhou ou é incompatível/)).toBeInTheDocument();
    expect(fakeService.previewSearch).not.toHaveBeenCalled();
  });

  it('handles empty database selection', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument();
    });

    const dbs = ['OpenAlex', 'Crossref', 'Scopus', 'Web of Science'];
    for (const db of dbs) {
      const btn = screen.getByRole('button', { name: new RegExp(db, 'i') });
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Selecione pelo menos uma base.')).toBeInTheDocument();
    });
  });

  it('handles search error of string type', async () => {
    fakeService.previewSearch.mockRejectedValue('String error message');
    renderPage();
    await waitFor(() => expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument());

    const wosBtn = screen.getByRole('button', { name: /Web of Science/i });
    await act(async () => {
      fireEvent.click(wosBtn);
    });

    const searchBtn = screen.getByRole('button', { name: /Fazer Busca/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(screen.getByText('String error message')).toBeInTheDocument();
  });

  it('handles search error of object type with error property', async () => {
    fakeService.previewSearch.mockRejectedValue({ error: 'Object error property' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument());

    const wosBtn = screen.getByRole('button', { name: /Web of Science/i });
    await act(async () => {
      fireEvent.click(wosBtn);
    });

    const searchBtn = screen.getByRole('button', { name: /Fazer Busca/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(screen.getByText('Object error property')).toBeInTheDocument();
  });

  it('handles search error of unknown object type', async () => {
    fakeService.previewSearch.mockRejectedValue({ unknown: 'data' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument());

    const wosBtn = screen.getByRole('button', { name: /Web of Science/i });
    await act(async () => {
      fireEvent.click(wosBtn);
    });

    const searchBtn = screen.getByRole('button', { name: /Fazer Busca/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(screen.getByText('{"unknown":"data"}')).toBeInTheDocument();
  });

  it('handles limit input changes and NaN fallback', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Projeto: Test Project')).toBeInTheDocument());

    // We can't query by label easily because the input doesn't have an associated id/htmlFor,
    // but we can find the input by value "50" since it's the limit input.
    const limitInput = screen.getByDisplayValue('50');

    // Change to valid number
    await act(async () => {
      fireEvent.change(limitInput, { target: { value: '100' } });
    });
    expect(limitInput).toHaveValue(100);

    // Change to empty string to trigger NaN -> 50 fallback
    await act(async () => {
      fireEvent.change(limitInput, { target: { value: '' } });
    });
    expect(limitInput).toHaveValue(50);
  });

  it('renders nothing and loads no project when the route has no id', async () => {
    // The live query translation is irrelevant without a project; keep it pending so it cannot update after the test.
    fakeService.translateQuery.mockReturnValue(new Promise(() => undefined));
    render(
      <ServicesProvider apiService={fakeService}>
        <MemoryRouter initialEntries={[`/projects/search`]}>
          <Routes>
            {/* Purposely missing :id to make id undefined */}
            <Route path="/projects/search" element={<SearchPage />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>,
    );

    // Project won't load since there's no id, the page returns null.
    // So there's nothing to click. We just ensure it renders null (no project title).
    expect(screen.queryByText('Fazer Nova Busca')).not.toBeInTheDocument();
    expect(fakeService.getProject).not.toHaveBeenCalled();
    expect(fakeService.getSetting).not.toHaveBeenCalled();
  });

  describe('search payload and limits', () => {
    const ready = () => waitFor(() => expect(screen.getByText('openalex-query')).toBeInTheDocument());
    const deselect = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

    it('sends each base its translation or its custom query, plus a readable description of the tree', async () => {
      renderPage();
      await ready();
      deselect(/Web of Science/);
      fireEvent.click(screen.getAllByRole('button', { name: /Substituir por Query Customizada/ })[1]);
      fireEvent.change(screen.getByPlaceholderText(/Digite a query exata/), { target: { value: 'custom-crossref' } });
      fireEvent.change(screen.getByDisplayValue('Mais Relevantes (Padrão)'), { target: { value: 'citations' } });

      fireEvent.click(screen.getByRole('button', { name: /Fazer Busca/ }));

      await screen.findByTestId('mock-summary-modal');
      expect(fakeService.previewSearch).toHaveBeenCalledWith(
        1,
        { openalex: 'openalex-query', crossref: 'custom-crossref', scopus: 'scopus-query' },
        50,
        'citations',
        '(Todos contém "")',
      );
    });

    it('describes a single rule without parentheses', async () => {
      renderPage();
      await ready();
      deselect(/Web of Science/);
      fireEvent.click(screen.getByText('Change Query'));

      fireEvent.click(screen.getByRole('button', { name: /Fazer Busca/ }));

      await screen.findByTestId('mock-summary-modal');
      expect(fakeService.previewSearch.mock.calls[0][4]).toBe('Título contém "test"');
    });

    it('warns about the Crossref and Scopus caps for large limits', async () => {
      renderPage();
      await ready();

      fireEvent.change(screen.getByDisplayValue('50'), { target: { value: '2000' } });

      expect(screen.getByText('Atenção: A base Crossref será limitada a 1.000 resultados.')).toBeInTheDocument();
      expect(
        screen.getByText(/Aviso: A base Scopus pode retornar erro \(Exceeds maximum\) para limites > 200/),
      ).toBeInTheDocument();
    });

    it('shows no cap warnings when those bases are not selected', async () => {
      renderPage();
      await ready();
      deselect(/Crossref/);
      deselect(/Scopus/);

      fireEvent.change(screen.getByDisplayValue('50'), { target: { value: '2000' } });

      expect(screen.queryByText(/Atenção: A base Crossref/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Aviso: A base Scopus/)).not.toBeInTheDocument();
    });

    it('shows a translating state until the translation arrives', async () => {
      fakeService.translateQuery.mockReturnValue(new Promise(() => undefined));
      renderPage();

      await waitFor(() => expect(screen.getAllByText('Traduzindo...').length).toBeGreaterThan(0));
    });

    it('selects only the free bases when no API keys are configured', async () => {
      fakeService.getSetting.mockResolvedValue(null);
      renderPage();
      await ready();

      expect(screen.queryByText('scopus-query')).not.toBeInTheDocument();
      expect(screen.getByText('crossref-query')).toBeInTheDocument();
    });

    it('returns to the dashboard when the project cannot be loaded', async () => {
      fakeService.getProject.mockRejectedValue(new Error('gone'));
      renderPage();

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    });
  });
});
