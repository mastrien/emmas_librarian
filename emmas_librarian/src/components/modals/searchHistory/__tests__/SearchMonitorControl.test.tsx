import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import type { SearchHistoryItem, SearchMonitor } from '../../../../types';
import { SearchHistoryModal } from '../../SearchHistoryModal';

const entry = (extra: Partial<SearchHistoryItem> = {}): SearchHistoryItem => ({
  id: 7,
  unified_query: 'Título contém "radar"',
  translated_queries: JSON.stringify({ openalex: 'q' }),
  total_results: 3,
  results_breakdown: JSON.stringify({ openalex: { count: 3 }, scopus: { count: 0 } }),
  created_at: '2026-09-12 10:00:00',
  ...extra,
});

const monitor = (extra: Partial<SearchMonitor> = {}): SearchMonitor => ({
  search_id: 7,
  interval_days: 7,
  last_checked_at: null,
  pending_count: 0,
  failed_bases: [],
  project_id: 3,
  project_name: 'P',
  unified_query: 'q',
  ...extra,
});

function open(service: FakeProjectService, history: SearchHistoryItem[] = [entry()]) {
  render(
    <MemoryRouter>
      <ServicesProvider apiService={service}>
        <SearchHistoryModal isOpen onClose={() => undefined} history={history} embedded projectId={3} />
      </ServicesProvider>
    </MemoryRouter>,
  );
}

const box = () => screen.findByRole('checkbox', { name: 'Monitorar esta busca' });

describe('SearchMonitorControl (#52)', () => {
  it('starts unmarked, with no interval and no cost line', async () => {
    open(new FakeProjectService());

    expect(await box()).not.toBeChecked();
    expect(screen.queryByLabelText('Intervalo da verificação')).not.toBeInTheDocument();
  });

  it('marking asks for a week, says what a check spends and offers the three intervals', async () => {
    const service = new FakeProjectService();
    service.setSearchMonitor.mockResolvedValue([monitor()]);
    open(service);

    fireEvent.click(await box());

    await waitFor(() => expect(service.setSearchMonitor).toHaveBeenCalledWith(3, 7, 7));
    const interval = await screen.findByLabelText('Intervalo da verificação');
    expect([...(interval as HTMLSelectElement).options].map((o) => o.text)).toEqual([
      'Todo dia',
      'Toda semana',
      'A cada 2 semanas',
    ]);
    expect(screen.getByText(/Cada verificação roda esta busca em openalex, scopus/)).toBeInTheDocument();
    expect(screen.getByText('Primeira verificação na próxima abertura do app')).toBeInTheDocument();
  });

  it('changes the interval and stops', async () => {
    const service = new FakeProjectService();
    service.getSearchMonitors.mockResolvedValue([monitor({ last_checked_at: '2026-11-01T12:00:00.000Z' })]);
    service.setSearchMonitor.mockResolvedValue([monitor({ interval_days: 14 })]);
    open(service);

    const interval = await screen.findByLabelText('Intervalo da verificação');
    expect(screen.getByText(/Última verificação em/)).toBeInTheDocument();
    fireEvent.change(interval, { target: { value: '14' } });
    await waitFor(() => expect(service.setSearchMonitor).toHaveBeenCalledWith(3, 7, 14));

    service.setSearchMonitor.mockResolvedValue([]);
    fireEvent.click(await box());
    await waitFor(() => expect(service.setSearchMonitor).toHaveBeenLastCalledWith(3, 7, null));
    await waitFor(() => expect(screen.queryByLabelText('Intervalo da verificação')).not.toBeInTheDocument());
  });

  it('shows why a change failed', async () => {
    const service = new FakeProjectService();
    service.setSearchMonitor.mockRejectedValue(new Error('banco ocupado'));
    open(service);

    fireEvent.click(await box());

    expect(await screen.findByRole('alert')).toHaveTextContent('banco ocupado');
  });

  it('marks what monitoring saved, which cannot be monitored again', async () => {
    const service = new FakeProjectService();
    open(service, [entry({ unified_query: 'Monitoramento da busca #3: x' })]);

    expect(await screen.findByText('Resultado do monitoramento')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Monitorar esta busca' })).not.toBeInTheDocument();
  });

  it('is not offered where there is no query to run', async () => {
    const service = new FakeProjectService();
    open(service, [
      entry({ translated_queries: JSON.stringify({ import: 'x' }), results_breakdown: '{"import":{"count":1}}' }),
    ]);

    await waitFor(() => expect(service.getSearchMonitors).toHaveBeenCalled());
    expect(screen.queryByRole('checkbox', { name: 'Monitorar esta busca' })).not.toBeInTheDocument();
  });
});
