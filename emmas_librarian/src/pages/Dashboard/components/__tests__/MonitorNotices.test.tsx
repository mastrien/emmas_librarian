import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import type { MonitorNotice, SearchPreview } from '../../../../types';
import { MonitorNotices } from '../MonitorNotices';

const notice = (extra: Partial<MonitorNotice> = {}): MonitorNotice => ({
  searchId: 7,
  projectId: 3,
  projectName: 'Revisão',
  query: 'Título contém "radar"',
  newCount: 5,
  failedBases: [],
  checkedAt: '2026-11-02T00:00:00.000Z',
  ...extra,
});

const PREVIEW: SearchPreview = {
  previewId: 'p7',
  breakdown: { openalex: { count: 2 } },
  results: [
    { title: 'Novo', sourceDatabases: ['OpenAlex'], alreadyInProject: false, details: {} },
    { title: 'Antigo', sourceDatabases: ['OpenAlex'], alreadyInProject: true, details: {} },
  ],
} as SearchPreview;

function open(service: FakeProjectService) {
  render(
    <ServicesProvider apiService={service}>
      <MonitorNotices />
    </ServicesProvider>,
  );
}

const section = () => screen.findByRole('region', { name: 'Novidades nas buscas monitoradas' });

describe('MonitorNotices (#52)', () => {
  it('shows nothing and checks nothing when nothing is due or found', async () => {
    const service = new FakeProjectService();
    open(service);

    await waitFor(() => expect(service.getMonitorOverview).toHaveBeenCalled());

    expect(service.checkDueMonitors).not.toHaveBeenCalled();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says it is checking, then what it found', async () => {
    const service = new FakeProjectService();
    let finish: (value: { dueCount: number; notices: MonitorNotice[] }) => void = () => undefined;
    service.getMonitorOverview.mockResolvedValue({ dueCount: 1, notices: [] });
    service.checkDueMonitors.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    open(service);

    expect(await screen.findByRole('status')).toHaveTextContent('Verificando as buscas monitoradas');
    finish({ dueCount: 0, notices: [notice()] });

    expect(await section()).toHaveTextContent('5 artigos novos em Revisão');
    expect(await section()).toHaveTextContent('Busca #7: Título contém "radar"');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('shows what the last check found without checking again', async () => {
    const service = new FakeProjectService();
    service.getMonitorOverview.mockResolvedValue({ dueCount: 0, notices: [notice({ newCount: 1 })] });
    open(service);

    expect(await section()).toHaveTextContent('1 artigo novo em Revisão');
    expect(service.checkDueMonitors).not.toHaveBeenCalled();
  });

  it('names a base it could not check, with nothing to review when nothing was found', async () => {
    const service = new FakeProjectService();
    service.getMonitorOverview.mockResolvedValue({
      dueCount: 0,
      notices: [notice({ newCount: 0, failedBases: ['scopus'] })],
    });
    open(service);

    const card = await section();
    expect(card).toHaveTextContent('Não verificou: scopus.');
    expect(within(card).queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument();
  });

  it('opens the preview showing what is new, and saving goes through the search preview', async () => {
    const service = new FakeProjectService();
    service.getMonitorOverview.mockResolvedValue({ dueCount: 0, notices: [notice()] });
    service.reviewMonitor.mockResolvedValue(PREVIEW);
    open(service);

    fireEvent.click(within(await section()).getByRole('button', { name: 'Revisar' }));

    const list = await screen.findByRole('list', { name: 'Artigos encontrados' });
    expect(service.reviewMonitor).toHaveBeenCalledWith(7);
    expect(list).toHaveTextContent('Novo');
    expect(list).not.toHaveTextContent('Antigo');
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));

    await waitFor(() => expect(service.saveSearchPreview).toHaveBeenCalledWith('p7'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('discarding sets them aside', async () => {
    const service = new FakeProjectService();
    service.getMonitorOverview.mockResolvedValue({ dueCount: 0, notices: [notice()] });
    service.reviewMonitor.mockResolvedValue(PREVIEW);
    open(service);
    fireEvent.click(within(await section()).getByRole('button', { name: 'Revisar' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));

    expect(service.discardSearchPreview).toHaveBeenCalledWith('p7');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the notice and says why when the review cannot open', async () => {
    const service = new FakeProjectService();
    service.getMonitorOverview.mockResolvedValue({ dueCount: 0, notices: [notice()] });
    service.reviewMonitor.mockRejectedValue(new Error('429 do OpenAlex'));
    open(service);

    fireEvent.click(within(await section()).getByRole('button', { name: 'Revisar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('429 do OpenAlex');
    expect(await section()).toHaveTextContent('5 artigos novos');
  });

  it('dismisses until the next check', async () => {
    const service = new FakeProjectService();
    service.getMonitorOverview.mockResolvedValue({ dueCount: 0, notices: [notice()] });
    open(service);

    fireEvent.click(within(await section()).getByRole('button', { name: 'Dispensar o aviso' }));

    expect(service.dismissMonitorNotice).toHaveBeenCalledWith(7);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('never keeps the dashboard from opening when a check fails', async () => {
    const service = new FakeProjectService();
    service.getMonitorOverview.mockResolvedValue({ dueCount: 1, notices: [] });
    service.checkDueMonitors.mockRejectedValue(new Error('sem rede'));
    open(service);

    await waitFor(() => expect(service.checkDueMonitors).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
