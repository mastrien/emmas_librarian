import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, it, expect } from 'vitest';
import { SystematicReviewPage } from '../SystematicReviewPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import { EXCLUDED, INCLUDED, MAYBE, reviewArticle, screeningService, storedDecision } from './screeningTestData';
import { FakeDialogsProvider } from '../../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import { ProjectNavSlotHost, ProjectNavSlotProvider } from '../../../components/common/shell/projectNavSlot';

function renderReview(service: FakeProjectService) {
  render(
    <MemoryRouter initialEntries={['/projects/1/review']}>
      <ServicesProvider apiService={service}>
        <FakeDialogsProvider>
          {/* The spot the project sidebar gives the review for its parts (board 164). */}
          <ProjectNavSlotProvider>
            <ProjectNavSlotHost />
            <Routes>
              <Route path="/projects/:id/review" element={<SystematicReviewPage />} />
              <Route path="/projects/:id" element={<div>Página do projeto</div>} />
            </Routes>
          </ProjectNavSlotProvider>
        </FakeDialogsProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
}

const section = (name: RegExp) => screen.getByRole('region', { name });

// Board 164: the list shows one status at a time, chosen in the "Status da triagem" control.
async function showStatus(name: string) {
  const statuses = await screen.findByRole('group', { name: 'Status da triagem' });
  fireEvent.click(within(statuses).getByRole('button', { name: new RegExp(`^${name}`) }));
}
// Board 164: "Título e resumo | Texto completo" chooses the stage the list shows.
function showStage(name: string) {
  fireEvent.click(within(screen.getByRole('group', { name: 'Etapa' })).getByRole('button', { name }));
}
const pendingRow = (title: string) => screen.getByText(title).closest('[data-testid="review-row"]') as HTMLElement;

async function pickLabel(row: HTMLElement, button: RegExp, label: string) {
  fireEvent.click(within(row).getByRole('button', { name: button }));
  fireEvent.click(await within(row).findByRole('menuitem', { name: new RegExp(label) }));
}

describe('SystematicReviewPage (#49)', () => {
  // The chosen status is kept for the session; each test starts on the default one.
  beforeEach(() => sessionStorage.clear());

  it('groups articles by label, counts them, and lists the undecided ones', async () => {
    const service = screeningService(
      [reviewArticle(1, 'GPM'), reviewArticle(2, 'MetNet'), reviewArticle(3, 'ConvLSTM', { status: 'read' })],
      [storedDecision(1, INCLUDED), storedDecision(2, MAYBE)],
    );
    renderReview(service);

    expect(await screen.findByRole('heading', { name: 'Triagem' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Contagem da triagem' })).toHaveTextContent('1 incluídos');
    expect(within(pendingRow('ConvLSTM')).getByText('lido')).toBeInTheDocument();
    expect(screen.queryByText('GPM')).not.toBeInTheDocument();
    await showStatus('Incluídos');
    expect(within(section(/^Incluso \(1\)/)).getByText('GPM')).toBeInTheDocument();
    await showStatus('Em dúvida');
    expect(within(section(/^Em dúvida \(1\)/)).getByText('MetNet')).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: 'Selecionar vários' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar ConvLSTM' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar GPM' }));
    const bar = screen.getByRole('region', { name: 'Ações para os artigos selecionados' });
    fireEvent.click(within(bar).getByRole('button', { name: /Aplicar rótulo/ }));
    fireEvent.click(within(bar).getByRole('menuitem', { name: /Excluído/ }));

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([3, 5], EXCLUDED, 'title', null));
  });

  it('shows an exclusion with its reason, and takes it back at the stage it was made', async () => {
    const archived = reviewArticle(6, 'Attention', { status: 'archived', archive_note: 'Excluído · só texto' });
    const service = screeningService(
      [archived],
      [storedDecision(6, INCLUDED, 'title'), storedDecision(6, EXCLUDED, 'full', 'só texto')],
    );
    renderReview(service);
    await screen.findByRole('heading', { name: 'Triagem' });
    showStage('Texto completo');
    await showStatus('Excluídos');

    const excluded = await screen.findByRole('region', { name: /^Excluídos \(1\)/ });
    expect(within(excluded).getByText('Motivo: Excluído · só texto')).toBeInTheDocument();
    fireEvent.click(within(excluded).getByRole('button', { name: 'Desfazer exclusão' }));

    await waitFor(() => expect(service.undecideScreening).toHaveBeenCalledWith([6], 'full'));
  });

  it('keeps articles archived by hand apart until they get a label', async () => {
    const service = screeningService([reviewArticle(7, 'Review', { status: 'archived', archive_note: 'revisão' })]);
    renderReview(service);
    await showStatus('Excluídos');

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
    await screen.findByRole('heading', { name: 'Triagem' });
    showStage('Texto completo');
    await showStatus('Em dúvida');

    await pickLabel(await screen.findByRole('region', { name: /^Em dúvida \(1\)/ }), /Rótulo/, 'Incluso');

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([1], INCLUDED, 'full', 'ver métodos'));
  });

  // Board 164: the tabs became the review's items in the project sidebar; the way back is the sidebar too.
  it('lists its parts in the project sidebar, the screening with what is left to decide', async () => {
    renderReview(screeningService([reviewArticle(1, 'GPM'), reviewArticle(2, 'IMERG')]));

    const parts = await screen.findByRole('navigation', { name: 'Partes da revisão' });
    expect(within(parts).getByRole('link', { name: 'Triagem 2 sem decisão' })).toHaveAttribute('aria-current', 'page');
    expect(within(parts).getByRole('link', { name: 'Diagrama PRISMA' })).toHaveAttribute(
      'href',
      '/projects/1/review/prisma',
    );
    expect(screen.queryByRole('link', { name: /Voltar ao projeto/ })).not.toBeInTheDocument();
  });

  it('says how many articles were decided under the title', async () => {
    renderReview(
      screeningService([reviewArticle(1, 'GPM'), reviewArticle(2, 'IMERG')], [storedDecision(1, INCLUDED, 'title')]),
    );

    expect(await screen.findByText('1 de 2 decididos por título e resumo')).toBeInTheDocument();
  });

  it('closes a section and a label menu', async () => {
    renderReview(
      screeningService([reviewArticle(1, 'GPM'), reviewArticle(2, 'MetNet')], [storedDecision(1, INCLUDED)]),
    );

    await showStatus('Incluídos');
    const included = await screen.findByRole('region', { name: /^Incluso \(1\)/ });
    fireEvent.click(within(included).getByRole('button', { name: /^Incluso \(1\)/ }));
    expect(within(included).queryByText('GPM')).toBeNull();
    await showStatus('Sem decisão');
    fireEvent.click(within(pendingRow('MetNet')).getByRole('button', { name: /Rótulo/ }));
    expect(screen.getByRole('menu', { name: 'Rótulos' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('decides a pending article in one click with the first label of the kind', async () => {
    const service = screeningService([reviewArticle(3, 'ConvLSTM')]);
    renderReview(service);

    fireEvent.click(await screen.findByRole('button', { name: 'Dúvida ConvLSTM' }));

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([3], MAYBE, 'title', null));
  });

  it('shows how much is decided as a progress bar over the list', async () => {
    renderReview(
      screeningService([reviewArticle(1, 'GPM'), reviewArticle(2, 'IMERG')], [storedDecision(1, INCLUDED, 'title')]),
    );

    const bar = await screen.findByRole('progressbar', { name: 'Triagem decidida' });

    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '2');
  });

  it('labels a pending line "sem decisão", with the keys of the quick decisions on their buttons', async () => {
    renderReview(screeningService([reviewArticle(3, 'ConvLSTM')]));

    await screen.findByText('ConvLSTM');

    expect(within(pendingRow('ConvLSTM')).getByText('sem decisão')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Incluir ConvLSTM' })).toHaveTextContent('A');
    expect(screen.getByRole('button', { name: 'Dúvida ConvLSTM' })).toHaveTextContent('E');
    expect(screen.getByRole('button', { name: 'Excluir ConvLSTM' })).toHaveTextContent('R');
  });

  it('decides the line under the pointer with A, E and R, the keys of the audit', async () => {
    const service = screeningService([reviewArticle(3, 'ConvLSTM'), reviewArticle(4, 'GPM')]);
    renderReview(service);
    await screen.findByText('ConvLSTM');

    fireEvent.mouseEnter(pendingRow('GPM'));
    fireEvent.keyDown(window, { key: 'e' });

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([4], MAYBE, 'title', null));
  });

  // Review of PR #187: a decided row leaves the list without a mouseleave, and the next key press decided it again.
  it('does not decide a row that already left the list when the key is pressed again with the pointer still', async () => {
    const service = screeningService([reviewArticle(3, 'ConvLSTM'), reviewArticle(4, 'GPM')]);
    renderReview(service);
    await screen.findByText('GPM');
    fireEvent.mouseEnter(pendingRow('GPM'));

    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() => expect(screen.queryByText('GPM')).not.toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'a' });

    expect(service.decideScreening).toHaveBeenCalledTimes(1);
  });

  it('ignores a key held down, which would repeat the decision', async () => {
    const service = screeningService([reviewArticle(3, 'ConvLSTM')]);
    renderReview(service);
    await screen.findByText('ConvLSTM');
    fireEvent.mouseEnter(pendingRow('ConvLSTM'));

    fireEvent.keyDown(window, { key: 'a', repeat: true });

    expect(service.decideScreening).not.toHaveBeenCalled();
  });

  it('leaves the selection mode when the stage changes, instead of carrying the ids to the other stage', async () => {
    renderReview(screeningService([reviewArticle(1, 'GPM'), reviewArticle(2, 'IMERG')]));
    fireEvent.click(await screen.findByRole('button', { name: 'Selecionar vários' }));
    expect(screen.getByRole('region', { name: 'Ações para os artigos selecionados' })).toBeInTheDocument();

    showStage('Texto completo');
    showStage('Título e resumo');

    expect(screen.queryByRole('region', { name: 'Ações para os artigos selecionados' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Selecionar vários' })).toBeInTheDocument();
  });

  // The numbers were the keys before; the author wants the audit's A, E and R instead (departs from board 164).
  it('no longer decides with the numbers 1, 2 and 3', async () => {
    const service = screeningService([reviewArticle(4, 'GPM')]);
    renderReview(service);
    await screen.findByText('GPM');
    fireEvent.mouseEnter(pendingRow('GPM'));

    for (const key of ['1', '2', '3']) fireEvent.keyDown(window, { key });

    expect(service.decideScreening).not.toHaveBeenCalled();
  });

  it('ignores the keys when no line is under the pointer, or while typing', async () => {
    const service = screeningService([reviewArticle(3, 'ConvLSTM')]);
    renderReview(service);
    await screen.findByText('ConvLSTM');

    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.mouseEnter(pendingRow('ConvLSTM'));
    const field = document.createElement('input');
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: 'a' });
    field.remove();

    expect(service.decideScreening).not.toHaveBeenCalled();
  });

  it('says which of the pending articles the page shows', async () => {
    renderReview(screeningService([reviewArticle(1, 'GPM'), reviewArticle(2, 'IMERG')]));

    expect(await screen.findByText(/1–2 de\s+2/)).toBeInTheDocument();
  });

  it('opens on the included ones once nothing waits for a decision, and says when a status is empty', async () => {
    renderReview(screeningService([reviewArticle(1, 'GPM')], [storedDecision(1, INCLUDED)]));

    expect(await screen.findByRole('button', { name: /^Incluídos/ })).toHaveAttribute('aria-pressed', 'true');
    await showStatus('Removidos antes');

    expect(screen.getByText('Nenhum artigo com este status.')).toBeInTheDocument();
  });
});

describe('SystematicReviewPage stage toggle (board 164)', () => {
  beforeEach(() => sessionStorage.clear());

  it('shows the title stage first, and what is decided at full text only after choosing it', async () => {
    renderReview(
      screeningService(
        [reviewArticle(1, 'GPM'), reviewArticle(2, 'IMERG')],
        [storedDecision(1, INCLUDED, 'title'), storedDecision(1, EXCLUDED, 'full', 'só texto')],
      ),
    );

    expect(await screen.findByText('1 de 2 decididos por título e resumo')).toBeInTheDocument();
    showStage('Texto completo');

    expect(await screen.findByText('1 de 1 decididos por texto completo')).toBeInTheDocument();
  });

  it('decides at the stage on screen', async () => {
    const service = screeningService([reviewArticle(1, 'GPM')], [storedDecision(1, INCLUDED, 'title')]);
    renderReview(service);
    await screen.findByRole('heading', { name: 'Triagem' });
    showStage('Texto completo');

    fireEvent.click(await screen.findByRole('button', { name: 'Dúvida GPM' }));

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([1], MAYBE, 'full', null));
  });
});
