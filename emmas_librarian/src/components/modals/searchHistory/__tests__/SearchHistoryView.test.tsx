import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import { FakeDialogs, FakeDialogsProvider } from '../../../common/dialogs/__tests__/fakes/FakeDialogs';
import type { SearchHistoryItem, SearchMonitor } from '../../../../types';
import { SearchHistoryView } from '../SearchHistoryView';
import { StrategyExportMenu } from '../StrategyExportMenu';

const search = (id: number, extra: Partial<SearchHistoryItem> = {}): SearchHistoryItem => ({
  id,
  unified_query: `forecast AND rain ${id}`,
  translated_queries: JSON.stringify({ scopus: `TITLE("forecast") ${id}` }),
  total_results: 46,
  results_breakdown: JSON.stringify({ scopus: { count: 20 }, openalex: { count: 20 } }),
  created_at: '2026-08-07T14:58:00',
  query_state: JSON.stringify({ terms: [{ field: 'title', value: 'forecast' }] }),
  ...extra,
});

async function renderView(history: SearchHistoryItem[], monitors: Partial<SearchMonitor>[] = []) {
  const service = FakeProjectService.create();
  service.getSearchMonitors.mockResolvedValue(monitors as SearchMonitor[]);
  const dialogs = new FakeDialogs();
  const onRevertSearch = vi.fn();
  render(
    <MemoryRouter>
      <ServicesProvider apiService={service}>
        <FakeDialogsProvider dialogs={dialogs}>
          <SearchHistoryView history={history} projectId={3} onRevertSearch={onRevertSearch} />
        </FakeDialogsProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('navigation', { name: 'Buscas do projeto' });
  return { service, onRevertSearch };
}

const list = () => within(screen.getByRole('navigation', { name: 'Buscas do projeto' }));

describe('SearchHistoryView', () => {
  it('lists each entry with its bases and how many it saved, and opens the first', async () => {
    await renderView([search(2), search(1)]);

    const first = list().getAllByRole('button')[0];
    expect(first).toHaveTextContent('Busca #2');
    expect(first).toHaveTextContent('Scopus · OpenAlex');
    expect(first).toHaveTextContent('46 salvos');
    expect(first).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Busca #2' })).toBeInTheDocument();
  });

  it('shows the chosen entry: its query and what each base received', async () => {
    await renderView([search(2), search(1)]);

    fireEvent.click(list().getByRole('button', { name: /Busca #1/ }));

    const detail = within(screen.getByRole('article', { name: 'Busca #1' }));
    expect(detail.getByText('forecast AND rain 1')).toBeInTheDocument();
    expect(detail.getByText('TITLE("forecast") 1')).toBeInTheDocument();
  });

  it('marks a watched search', async () => {
    await renderView([search(2)], [{ search_id: 2, interval_days: 7, failed_bases: [] }]);

    expect(await list().findByText('Monitorada')).toBeInTheDocument();
  });

  it('undoes the chosen search after confirmation', async () => {
    const { onRevertSearch } = await renderView([search(2)]);

    fireEvent.click(screen.getByRole('button', { name: /Desfazer Busca/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer Busca' }));

    expect(onRevertSearch).toHaveBeenCalledWith(2);
  });

  it('says so when the project has no searches', async () => {
    const service = FakeProjectService.create();
    render(
      <MemoryRouter>
        <ServicesProvider apiService={service}>
          <SearchHistoryView history={[]} projectId={3} onRevertSearch={vi.fn()} />
        </ServicesProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Nenhuma busca registrada ainda.')).toBeInTheDocument();
  });
});

describe('StrategyExportMenu', () => {
  it('exports the strategy in the chosen format from its menu', async () => {
    const onExport = vi.fn(async () => 'C:/estrategia.md');
    render(
      <FakeDialogsProvider dialogs={new FakeDialogs()}>
        <StrategyExportMenu onExport={onExport} />
      </FakeDialogsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Exportar estratégia/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar estratégia de busca (Markdown)' }));

    expect(onExport).toHaveBeenCalledWith('md');
  });
});
