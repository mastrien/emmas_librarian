import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { SystematicReviewPage } from '../SystematicReviewPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import { EXCLUDED, INCLUDED, MAYBE, reviewArticle, screeningService, storedDecision } from './screeningTestData';

function renderReview(service: FakeProjectService) {
  render(
    <MemoryRouter initialEntries={['/projects/1/review']}>
      <ServicesProvider apiService={service}>
        <Routes>
          <Route path="/projects/:id/review" element={<SystematicReviewPage />} />
          <Route path="/projects/:id" element={<div>Página do projeto</div>} />
        </Routes>
      </ServicesProvider>
    </MemoryRouter>,
  );
}

const section = (name: RegExp) => screen.getByRole('region', { name });
const pendingRow = (title: string) => screen.getByText(title).closest('[data-testid="review-row"]') as HTMLElement;

async function pickLabel(row: HTMLElement, button: RegExp, label: string) {
  fireEvent.click(within(row).getByRole('button', { name: button }));
  fireEvent.click(await within(row).findByRole('menuitem', { name: new RegExp(label) }));
}

describe('SystematicReviewPage (#49)', () => {
  it('groups articles by label, counts them, and lists the undecided ones', async () => {
    const service = screeningService(
      [reviewArticle(1, 'GPM'), reviewArticle(2, 'MetNet'), reviewArticle(3, 'ConvLSTM', { status: 'read' })],
      [storedDecision(1, INCLUDED), storedDecision(2, MAYBE)],
    );
    renderReview(service);

    expect(await screen.findByRole('heading', { name: 'Revisão sistemática' })).toBeInTheDocument();
    expect(within(section(/^Incluso \(1\)/)).getByText('GPM')).toBeInTheDocument();
    expect(within(section(/^Em dúvida \(1\)/)).getByText('MetNet')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Contagem da triagem' })).toHaveTextContent('1 incluídos');
    expect(within(pendingRow('ConvLSTM')).getByText('lido')).toBeInTheDocument();
  });

  it('decides an undecided article from its menu, and undoes it from the toast', async () => {
    const service = screeningService([reviewArticle(3, 'ConvLSTM')]);
    renderReview(service);

    await pickLabel(await screen.findByText('ConvLSTM').then(() => pendingRow('ConvLSTM')), /Rótulo/, 'Incluso');

    expect(service.decideScreening).toHaveBeenCalledWith([3], INCLUDED, 'title', null);
    expect(await screen.findByRole('region', { name: /^Incluso \(1\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /^Incluso/ })).toBeNull());
    expect(service.undecideScreening).toHaveBeenCalledWith([3], 'title');
    expect(pendingRow('ConvLSTM')).toBeInTheDocument();
  });

  it('applies one label to the selected articles', async () => {
    const service = screeningService([
      reviewArticle(3, 'ConvLSTM'),
      reviewArticle(4, 'MetNet'),
      reviewArticle(5, 'GPM'),
    ]);
    renderReview(service);

    fireEvent.click(await screen.findByRole('button', { name: 'Selecionar' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar ConvLSTM' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar GPM' }));
    const bar = screen.getByRole('region', { name: 'Ações para os artigos selecionados' });
    fireEvent.click(within(bar).getByRole('button', { name: /Aplicar rótulo/ }));
    fireEvent.click(within(bar).getByRole('menuitem', { name: /Excluído/ }));

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([3, 5], EXCLUDED, 'title', null));
  });

  it('shows an exclusion with its reason, and takes it back at the stage it was made', async () => {
    const archived = reviewArticle(6, 'Attention', { status: 'archived', archive_note: 'Excluído · só texto' });
    const service = screeningService([archived], [storedDecision(6, EXCLUDED, 'full', 'só texto')]);
    renderReview(service);

    const excluded = await screen.findByRole('region', { name: /^Excluídos \(1\)/ });
    expect(within(excluded).getByText('Motivo: Excluído · só texto')).toBeInTheDocument();
    fireEvent.click(within(excluded).getByRole('button', { name: 'Desfazer exclusão' }));

    await waitFor(() => expect(service.undecideScreening).toHaveBeenCalledWith([6], 'full'));
  });

  it('keeps articles archived by hand apart until they get a label', async () => {
    const service = screeningService([reviewArticle(7, 'Review', { status: 'archived', archive_note: 'revisão' })]);
    renderReview(service);

    const excluded = await screen.findByRole('region', { name: /^Excluídos \(1\)/ });
    expect(within(excluded).getByText('Arquivado no projeto (sem rótulo)')).toBeInTheDocument();
    expect(within(excluded).getByText('Nota de quando foi arquivado: revisão')).toBeInTheDocument();
    await pickLabel(excluded, /Dar rótulo/, 'Incluso');

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([7], INCLUDED, 'title', null));
  });

  it('changes a label at full text when the article already has a full-text decision', async () => {
    const service = screeningService(
      [reviewArticle(1, 'GPM')],
      [storedDecision(1, INCLUDED, 'title'), storedDecision(1, MAYBE, 'full', 'ver métodos')],
    );
    renderReview(service);

    await pickLabel(await screen.findByRole('region', { name: /^Em dúvida \(1\)/ }), /Rótulo/, 'Incluso');

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([1], INCLUDED, 'full', 'ver métodos'));
  });

  it('goes back to the project page', async () => {
    renderReview(screeningService([]));

    fireEvent.click(await screen.findByRole('link', { name: /Voltar ao projeto/ }));

    expect(screen.getByText('Página do projeto')).toBeInTheDocument();
  });

  it('closes a section and a label menu', async () => {
    renderReview(
      screeningService([reviewArticle(1, 'GPM'), reviewArticle(2, 'MetNet')], [storedDecision(1, INCLUDED)]),
    );

    const included = await screen.findByRole('region', { name: /^Incluso \(1\)/ });
    fireEvent.click(within(included).getByRole('button', { name: /^Incluso \(1\)/ }));
    expect(within(included).queryByText('GPM')).toBeNull();
    fireEvent.click(within(pendingRow('MetNet')).getByRole('button', { name: /Rótulo/ }));
    expect(screen.getByRole('menu', { name: 'Rótulos' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
  });
});
