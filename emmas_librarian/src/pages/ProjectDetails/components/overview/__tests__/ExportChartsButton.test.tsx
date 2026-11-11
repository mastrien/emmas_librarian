import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialogProvider } from '../../../../../components/common/dialogs/DialogProvider';
import { ServicesProvider } from '../../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../../services/__tests__/fakes/FakeProjectService';
import type { Article } from '../../../../../types';
import { ExportChartsButton } from '../ExportChartsButton';

const articles = [{ id: 1, title: 'A', status: 'new', year: 2020 } as Article];

function renderButton(service = FakeProjectService.create()) {
  render(
    <ServicesProvider apiService={service}>
      <DialogProvider>
        <ExportChartsButton articles={articles} />
      </DialogProvider>
    </ServicesProvider>,
  );
  return service;
}

describe('ExportChartsButton', () => {
  it('saves the charts as an SVG file and says it was done', async () => {
    const service = renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar gráficos' }));

    await waitFor(() => expect(service.saveExportedFile).toHaveBeenCalledOnce());
    const [content, name] = service.saveExportedFile.mock.calls[0];
    expect(name).toBe('graficos.svg');
    expect(content).toContain('<svg');
    expect(await screen.findByText('Gráficos exportados em SVG.')).toBeInTheDocument();
  });

  it('says nothing when the save window was cancelled', async () => {
    const service = FakeProjectService.create();
    service.saveExportedFile.mockResolvedValue(false);
    renderButton(service);

    fireEvent.click(screen.getByRole('button', { name: 'Exportar gráficos' }));

    await waitFor(() => expect(service.saveExportedFile).toHaveBeenCalled());
    expect(screen.queryByText('Gráficos exportados em SVG.')).not.toBeInTheDocument();
  });

  it('tells why the export failed', async () => {
    const service = FakeProjectService.create();
    service.saveExportedFile.mockRejectedValue(new Error('disco cheio'));
    renderButton(service);

    fireEvent.click(screen.getByRole('button', { name: 'Exportar gráficos' }));

    expect(await screen.findByText(/disco cheio/)).toBeInTheDocument();
  });
});
