import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { SystematicReviewPage } from '../SystematicReviewPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import { EXCLUDED, reviewArticle, screeningService, storedDecision } from './screeningTestData';

async function openLabels(service: FakeProjectService) {
  render(
    <MemoryRouter initialEntries={['/projects/1/review']}>
      <ServicesProvider apiService={service}>
        <Routes>
          <Route path="/projects/:id/review" element={<SystematicReviewPage />} />
        </Routes>
      </ServicesProvider>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Gerenciar rótulos/ }));
  return screen.getByRole('dialog', { name: 'Rótulos de triagem' });
}

describe('ManageLabelsModal (#49)', () => {
  it('adds a label of the chosen kind', async () => {
    const service = screeningService([]);
    const dialog = await openLabels(service);

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome do novo rótulo' }), {
      target: { value: 'Fora do período' },
    });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Tipo do rótulo' }), { target: { value: 'maybe' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    expect(await within(dialog).findByRole('textbox', { name: 'Nome do rótulo Fora do período' })).toBeInTheDocument();
    expect(service.createScreeningLabel).toHaveBeenCalledWith(1, { name: 'Fora do período', kind: 'maybe' });
  });

  it('renames a label when the name field loses focus', async () => {
    const service = screeningService([]);
    const dialog = await openLabels(service);

    const name = within(dialog).getByRole('textbox', { name: 'Nome do rótulo Excluído' });
    fireEvent.change(name, { target: { value: 'Fora do escopo' } });
    fireEvent.blur(name);

    await waitFor(() => expect(service.renameScreeningLabel).toHaveBeenCalledWith(EXCLUDED, 'Fora do escopo'));
  });

  it('asks what to do with the articles of a label in use, and moves them to another of its kind', async () => {
    const service = screeningService([reviewArticle(1, 'A', { status: 'archived' })], [storedDecision(1, EXCLUDED)]);
    service.screeningLabels.push({
      id: 9,
      project_id: 1,
      name: 'Fora do escopo',
      kind: 'exclude',
      position: 9,
      preset_key: null,
      created_at: '',
    });
    const dialog = await openLabels(service);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar Excluído' }));
    const prompt = within(dialog).getByRole('alertdialog', { name: 'Apagar Excluído' });
    expect(prompt).toHaveTextContent('1 artigo usa "Excluído"');
    fireEvent.click(within(prompt).getByRole('button', { name: 'Mover e apagar' }));

    await waitFor(() => expect(service.deleteScreeningLabel).toHaveBeenCalledWith(EXCLUDED, 9));
  });

  it('deletes a label nobody uses without asking', async () => {
    const service = screeningService([]);
    const dialog = await openLabels(service);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar Em dúvida' }));

    await waitFor(() => expect(service.deleteScreeningLabel).toHaveBeenCalledWith(2, null));
    expect(within(dialog).queryByRole('alertdialog')).toBeNull();
  });

  it('creates the PRISMA 2020 labels once', async () => {
    const service = screeningService([]);
    const dialog = await openLabels(service);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar rótulos do PRISMA 2020' }));

    expect(await within(dialog).findByText('Rótulos do PRISMA 2020 criados')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('textbox', { name: 'Nome do rótulo Texto completo não recuperado' }),
    ).toBeInTheDocument();
  });

  it('shows a refusal from the database in the window', async () => {
    const service = screeningService([]);
    service.createScreeningLabel.mockRejectedValueOnce(new Error('[ERR_INVALID_LABEL] nome longo demais'));
    const dialog = await openLabels(service);

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome do novo rótulo' }), { target: { value: 'X' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('nome longo demais');
  });

  it('moves a label among its kind, gives up a deletion and closes', async () => {
    const service = screeningService([reviewArticle(1, 'A', { status: 'archived' })], [storedDecision(1, EXCLUDED)]);
    const dialog = await openLabels(service);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Descer Excluído' }));
    await waitFor(() => expect(service.moveScreeningLabel).toHaveBeenCalledWith(EXCLUDED, 1));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar Excluído' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(within(dialog).queryByRole('alertdialog')).toBeNull();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Fechar' })[1]);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(service.deleteScreeningLabel).not.toHaveBeenCalled();
  });
});
