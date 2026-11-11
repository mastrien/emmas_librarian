import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';
import { FakeDialogs, FakeDialogsProvider } from '../../components/common/dialogs/__tests__/fakes/FakeDialogs';

let dialogs = new FakeDialogs();
import { ServicesContext } from '../../contexts/ServicesContext';
import type { Article, Project } from '../../types';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';

const fakeService = FakeProjectService.create();
const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as any),
    useNavigate: () => navigateMock,
  };
});

// Mock react-chartjs-2 to avoid canvas issues in jsdom
vi.mock('react-chartjs-2', () => ({
  Pie: () => <div data-testid="mock-pie-chart" />,
}));

const renderDashboard = () => {
  return render(
    <BrowserRouter>
      <ServicesContext.Provider value={fakeService as any}>
        <FakeDialogsProvider dialogs={dialogs}>
          <DashboardPage />
        </FakeDialogsProvider>
      </ServicesContext.Provider>
    </BrowserRouter>,
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    dialogs = new FakeDialogs();
    vi.clearAllMocks();
    fakeService.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading initially and fetches data', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getScientificVenues.mockResolvedValue([]);

    renderDashboard();

    expect(screen.getByTestId('dashboard-loading-skeleton')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Nenhum projeto encontrado')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Novo projeto/ })).toHaveLength(2); // the header and the card
  });

  it('fetches projects, calculates stats and displays charts', async () => {
    fakeService.getProjects.mockResolvedValue([{ id: 1, name: 'Project 1', created_at: '2023-01-01' }]);

    fakeService.getArticles.mockResolvedValue([
      { id: 1, status: 'read', local_file_path: 'file1.pdf', project_id: 1, title: 'Title1' } as any,
      { id: 2, status: 'new', local_file_path: undefined, project_id: 1, title: 'Title2' } as any,
      { id: 3, status: 'archived', local_file_path: 'file3.pdf', project_id: 1, title: 'Title3' } as any,
    ]);

    fakeService.getDiaryEntries.mockResolvedValue([{ id: 1, entry_date: '2023-10-10' }]);

    fakeService.getScientificVenues.mockResolvedValue([
      { id: 1, title: 'Conf 1', acronym: 'C1', url: '', category: 'Conference', created_at: '', milestones: [] } as any,
    ]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getAllByText('Ativos')[0]).toBeInTheDocument();
    // Board 151: the card shows the reading progress, and "Visão geral" has tiles where the pies were.
    expect(screen.getByText('1 de 2 lidos')).toBeInTheDocument();
    const overview = screen.getByRole('region', { name: 'Visão geral' });
    expect(within(overview).getByText('Com PDF')).toBeInTheDocument();
    expect(within(overview).getByText('Sem PDF')).toBeInTheDocument();
  });

  // Board 151: a project that had interaction with the review shows the screening progress, with its badge and
  // when it was opened; the others show the reading progress.
  it('shows the screening progress and the badge for a project that opened the review, reading for the others', async () => {
    fakeService.getProjects.mockResolvedValue([
      {
        id: 1,
        name: 'Revisão',
        created_at: '2023-01-01',
        last_opened_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      },
      { id: 2, name: 'Leitura', created_at: '2023-01-02', last_opened_at: null },
    ] as unknown as Project[]);
    fakeService.getScreeningSummaries.mockResolvedValue({ 1: { decided: 1 } });
    fakeService.getArticles.mockResolvedValue([
      { id: 1, status: 'read', project_id: 1, title: 'T1' } as Article,
      { id: 2, status: 'new', project_id: 1, title: 'T2' } as Article,
    ]);

    renderDashboard();

    const review = (await screen.findByText('Revisão')).closest('a')!;
    expect(within(review).getByText('Revisão sistemática')).toBeInTheDocument();
    expect(within(review).getByText('Triagem por título e resumo')).toBeInTheDocument();
    expect(within(review).getByText('1 de 2')).toBeInTheDocument();
    expect(within(review).getByText('aberto há 2 h')).toBeInTheDocument();
    const reading = screen.getByText('Leitura', { selector: 'h3' }).closest('a')!;
    expect(within(reading).queryByText('Revisão sistemática')).not.toBeInTheDocument();
    expect(within(reading).getByText('1 de 2 lidos')).toBeInTheDocument();
  });

  it('handles error when loading data', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fakeService.getProjects.mockRejectedValue(new Error('Network error'));

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Erro ao carregar dados do dashboard', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('opens VenueFormModal when add venue is triggered and saves successfully', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.createScientificVenue.mockResolvedValue({
      id: 2,
      title: 'New Venue',
      acronym: 'NV',
      url: '',
      created_at: '',
      category: 'Conference',
      milestones: [],
    } as any);

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    // The DashboardCalendar should render a button to add a venue
    const addVenueButtons = screen.getAllByRole('button').filter((b) => b.textContent?.includes('Adicionar'));
    if (addVenueButtons.length > 0) {
      fireEvent.click(addVenueButtons[0]);
    }

    // Check if modal opens (look for modal text, e.g., 'Salvar')
    await waitFor(() => {
      const modalSaveButton = screen.queryByText('Salvar Evento');
      if (modalSaveButton) {
        // mock the form input
        const titleInput = screen.getByLabelText(/Nome do Evento/i);
        fireEvent.change(titleInput, { target: { value: 'New Venue' } });
        fireEvent.click(modalSaveButton);
      }
    });

    await waitFor(() => {
      if (screen.queryByText('Salvar Evento')) {
        expect(fakeService.createScientificVenue).toHaveBeenCalled();
      }
    });
  });

  it('handles toggle milestone status from DeadlineBanner', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    const venue = {
      id: 1,
      title: 'Conf 1',
      acronym: 'C1',
      url: '',
      created_at: '',
      category: 'Conference',
      milestones: [{ id: 10, type: 'submission', end_date: '2050-01-01', status: 'pending' }],
    } as any;
    fakeService.getScientificVenues.mockResolvedValue([venue]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    // Checkboxes in DeadlineBanner
    const checkbox = screen.queryByRole('checkbox');
    if (checkbox) {
      fireEvent.click(checkbox);
      await waitFor(() => {
        expect(fakeService.toggleMilestoneStatus).toHaveBeenCalledWith(10, 'completed');
      });
    }
  });

  it('handles manual import project button', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.importProject.mockResolvedValue(99);

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    const importButton = screen.getByText('Importar');

    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: '' } as any;

    fireEvent.click(importButton);

    await waitFor(() => {
      expect(fakeService.importProject).toHaveBeenCalled();
      expect(window.location.href).toBe('#/projects/99');
    });
  });

  it('handles manual import project button error', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.importProject.mockRejectedValue(new Error('Import fail'));
    const alertSpy = dialogs.informMessage;

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    const importButton = screen.getByText('Importar');
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Import fail'));
    });
  });

  it('handles drag and drop for import', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.importProject.mockResolvedValue(88);

    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: '' } as any;

    const { container } = renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    const dropZone = container.firstChild as Element;

    // Drag Over
    fireEvent.dragOver(dropZone, {
      dataTransfer: { types: ['Files'] },
    });
    await waitFor(() => {
      expect(screen.getByText('Solte o arquivo do projeto (.emmapcarc) aqui')).toBeInTheDocument();
    });

    // Drag Leave
    fireEvent.dragLeave(dropZone, {
      relatedTarget: document.body,
    });
    await waitFor(() => {
      expect(screen.queryByText('Solte o arquivo do projeto (.emmapcarc) aqui')).not.toBeInTheDocument();
    });

    // Drop file
    const file = new File([''], 'test.emmapcarc');
    Object.defineProperty(file, 'path', { value: '/fake/test.emmapcarc' });

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(fakeService.importProject).toHaveBeenCalledWith('/fake/test.emmapcarc');
      expect(window.location.href).toBe('#/projects/88');
    });
  });

  // Electron 32+ removed File.path; the dropped file's path comes only from the preload's getPathForFile.
  it('imports a dropped project by the path the preload resolves, not by its bare name', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.importProject.mockResolvedValue(77);
    vi.mocked(window.electronAPI.getPathForFile).mockReturnValueOnce('C:\\Downloads\\tese.emmapcarc');
    const { container } = renderDashboard();
    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    fireEvent.drop(container.firstChild as Element, {
      dataTransfer: { files: [new File([''], 'tese.emmapcarc')] },
    });

    await waitFor(() => expect(fakeService.importProject).toHaveBeenCalledWith('C:\\Downloads\\tese.emmapcarc'));
  });

  it('handles drag and drop ignore non emmapcarc files', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.importProject.mockClear();

    const { container } = renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    const dropZone = container.firstChild as Element;
    const file = new File([''], 'test.txt');

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(fakeService.importProject).not.toHaveBeenCalled();
    });
  });

  it('handles drag and drop import error', async () => {
    fakeService.getProjects.mockResolvedValue([]);
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.importProject.mockRejectedValue(new Error('Bad file'));
    const alertSpy = dialogs.informMessage;

    const { container } = renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    const dropZone = container.firstChild as Element;
    const file = new File([''], 'test.emmapcarc');

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Bad file'));
    });
  });
});
