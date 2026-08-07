import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgendaPage } from '../AgendaPage';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';

// Mock child components
vi.mock('../../components/common/ScientificAgendaView', () => ({
  ScientificAgendaView: ({ onAddVenue, onEditVenue, onDeleteVenue, onToggleMilestoneStatus, venues }: any) => (
    <div data-testid="mock-agenda-view">
      Agenda View
      <div data-testid="venues-count">{venues.length}</div>
      <button onClick={() => onAddVenue('2023-01-01')}>Add Venue</button>
      <button onClick={() => onEditVenue({ id: 1, title: 'Test Venue' })}>Edit Venue</button>
      <button onClick={() => onDeleteVenue(1)}>Delete Venue</button>
      <button onClick={() => onToggleMilestoneStatus(1, 'completed')}>Toggle Milestone</button>
    </div>
  ),
}));

vi.mock('../../components/modals/VenueFormModal', () => ({
  VenueFormModal: ({ isOpen, onClose, onSave, initialData }: any) => (
    isOpen ? (
      <div data-testid="mock-venue-form">
        Venue Form
        <div data-testid="form-data">{initialData ? initialData.title : 'No Data'}</div>
        <button onClick={() => onSave({ title: 'New Venue', acronym: 'NV' })}>Save Venue</button>
        <button onClick={onClose}>Close Form</button>
      </div>
    ) : null
  ),
}));

describe('AgendaPage', () => {
  let fakeService: FakeProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeService = FakeProjectService.create();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const renderPage = () => {
    return render(
      <ServicesProvider apiService={fakeService}>
        <AgendaPage />
      </ServicesProvider>
    );
  };

  it('loads and displays venues', async () => {
    fakeService.getScientificVenues.mockResolvedValue([
      { id: 1, title: 'Venue 1', acronym: 'V1', url: '', created_at: '', category: 'conference' as const, milestones: [] }
    ]);
    renderPage();
    
    await waitFor(() => {
      expect(fakeService.getScientificVenues).toHaveBeenCalled();
      expect(screen.getByTestId('venues-count').textContent).toBe('1');
    });
  });

  it('handles load venues error', async () => {
    fakeService.getScientificVenues.mockRejectedValue(new Error('Load error'));
    renderPage();
    
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Erro ao carregar eventos da agenda:', expect.any(Error));
    });
  });

  it('opens add venue modal', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Add Venue'));
    });

    expect(screen.getByTestId('mock-venue-form')).toBeInTheDocument();
    expect(screen.getByTestId('form-data').textContent).toBe('No Data');
  });

  it('opens edit venue modal', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Edit Venue'));
    });

    expect(screen.getByTestId('mock-venue-form')).toBeInTheDocument();
    expect(screen.getByTestId('form-data').textContent).toBe('Test Venue');
  });

  it('saves new venue', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Add Venue'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Venue'));
    });

    expect(fakeService.createScientificVenue).toHaveBeenCalledWith({ title: 'New Venue', acronym: 'NV' });
    expect(fakeService.getScientificVenues).toHaveBeenCalledTimes(2); // Initial load + after save
    expect(screen.queryByTestId('mock-venue-form')).not.toBeInTheDocument();
  });

  it('updates existing venue', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Edit Venue'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Venue'));
    });

    expect(fakeService.updateScientificVenue).toHaveBeenCalledWith(1, { title: 'New Venue', acronym: 'NV' });
    expect(fakeService.getScientificVenues).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('mock-venue-form')).not.toBeInTheDocument();
  });

  it('handles save error', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.createScientificVenue.mockRejectedValue(new Error('Save error'));
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Add Venue'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Venue'));
    });

    expect(console.error).toHaveBeenCalledWith('Erro ao salvar evento:', expect.any(Error));
    // Should still be open
    expect(screen.getByTestId('mock-venue-form')).toBeInTheDocument();
  });

  it('deletes venue', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Delete Venue'));
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(fakeService.deleteScientificVenue).toHaveBeenCalledWith(1);
    expect(fakeService.getScientificVenues).toHaveBeenCalledTimes(2);
  });

  it('cancels delete venue', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => false);
    fakeService.getScientificVenues.mockResolvedValue([]);
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Delete Venue'));
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(fakeService.deleteScientificVenue).not.toHaveBeenCalled();
    expect(fakeService.getScientificVenues).toHaveBeenCalledTimes(1);
  });

  it('handles delete error', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.deleteScientificVenue.mockRejectedValue(new Error('Delete error'));
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Delete Venue'));
    });

    expect(console.error).toHaveBeenCalledWith('Erro ao excluir evento:', expect.any(Error));
  });

  it('toggles milestone status', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Toggle Milestone'));
    });

    expect(fakeService.toggleMilestoneStatus).toHaveBeenCalledWith(1, 'completed');
  });

  it('handles toggle milestone error', async () => {
    fakeService.getScientificVenues.mockResolvedValue([]);
    fakeService.toggleMilestoneStatus.mockRejectedValue(new Error('Toggle error'));
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-agenda-view')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Toggle Milestone'));
    });

    expect(console.error).toHaveBeenCalledWith('Erro ao alternar status do prazo:', expect.any(Error));
  });

  it('handles null venues returned from service', async () => {
    fakeService.getScientificVenues.mockResolvedValue(null as any);
    renderPage();
    
    await waitFor(() => {
      expect(fakeService.getScientificVenues).toHaveBeenCalled();
      // Should default to empty array, so count is 0
      expect(screen.getByTestId('venues-count').textContent).toBe('0');
    });
  });
});
