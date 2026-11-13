import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { GuidedScreeningPage } from '../GuidedScreeningPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import { DUPLICATE, EXCLUDED, INCLUDED, reviewArticle, screeningService, storedDecision } from './screeningTestData';
import { FakeDialogsProvider } from '../../../components/common/dialogs/__tests__/fakes/FakeDialogs';

// Where a link took the page, with the router state it carried.
const ReaderProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="reader">{JSON.stringify(location.state)}</div>;
};

function renderGuided(service: FakeProjectService) {
  render(
    <MemoryRouter initialEntries={['/projects/1/review/guided']}>
      <ServicesProvider apiService={service}>
        <FakeDialogsProvider>
          <Routes>
            <Route path="/projects/:id/review/guided" element={<GuidedScreeningPage />} />
            <Route path="/articles/:id" element={<ReaderProbe />} />
            <Route path="/projects/:id/review" element={<div>Página da revisão</div>} />
          </Routes>
        </FakeDialogsProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
}

const articles = [reviewArticle(1, 'ConvLSTM'), reviewArticle(2, 'MetNet'), reviewArticle(3, 'Attention')];

const heading = (title: string) => screen.findByRole('heading', { name: title, level: 2 });

describe('GuidedScreeningPage (#49)', () => {
  // Board 165: focus mode. The way out has its key, and the bar says where the screening stands.
  it('leaves with Escape, or by the link, and says how far the screening went', async () => {
    renderGuided(screeningService(articles, [storedDecision(1, INCLUDED, 'title')]));

    expect(await screen.findByText('Artigo 2 de 3')).toBeInTheDocument();
    expect(screen.getByText(/^1 decididos$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sair da triagem/ })).toHaveAttribute('href', '/projects/1/review');
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(await screen.findByText('Página da revisão')).toBeInTheDocument();
  });

  it('keeps Escape for the note while it is being typed', async () => {
    renderGuided(screeningService(articles));
    await heading('ConvLSTM');

    fireEvent.keyDown(screen.getByPlaceholderText(/só usa radar/), { key: 'Escape' });

    expect(screen.queryByText('Página da revisão')).not.toBeInTheDocument();
  });

  it('shows one article with its abstract and decides it with a key, moving to the next', async () => {
    const service = screeningService(articles);
    renderGuided(service);

    expect(await heading('ConvLSTM')).toBeInTheDocument();
    expect(screen.getByText('Resumo de ConvLSTM')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '1' });

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([1], INCLUDED, 'title', null));
    expect(await heading('MetNet')).toBeInTheDocument();
  });

  // After a click the styled switch keeps focus on its hidden checkbox; the decision keys must still work from there.
  it('still decides with a key right after a click on a switch, whose hidden checkbox keeps the focus', async () => {
    const service = screeningService(articles);
    renderGuided(service);
    await heading('ConvLSTM');
    const onlyPending = screen.getByRole('switch', { name: 'Só pendentes' });
    fireEvent.click(onlyPending);

    fireEvent.keyDown(onlyPending, { key: '1' });

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([1], INCLUDED, 'title', null));
  });

  it('sends the note with the decision, and does not decide while the note is being typed', async () => {
    const service = screeningService(articles);
    renderGuided(service);

    const note = await screen.findByRole('textbox', { name: /Nota/ });
    fireEvent.change(note, { target: { value: 'só radar' } });
    fireEvent.keyDown(note, { key: '3' });
    fireEvent.click(screen.getByRole('button', { name: /Excluído/ }));

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([1], EXCLUDED, 'title', 'só radar'));
    expect(service.decideScreening).toHaveBeenCalledTimes(1);
  });

  it('marks a duplicate with D and takes it back with Z', async () => {
    const service = screeningService(articles);
    renderGuided(service);

    await heading('ConvLSTM');
    fireEvent.keyDown(window, { key: 'd' });
    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([1], DUPLICATE, 'title', null));
    await heading('MetNet');
    fireEvent.keyDown(window, { key: 'z' });

    await waitFor(() => expect(service.undecideScreening).toHaveBeenCalledWith([1], 'title'));
    expect(await heading('ConvLSTM')).toBeInTheDocument();
  });

  it('ends the title stage and walks only the kept articles at full text', async () => {
    const service = screeningService(articles, [storedDecision(1, INCLUDED), storedDecision(2, EXCLUDED)]);
    renderGuided(service);

    await heading('Attention');
    fireEvent.keyDown(window, { key: '1' });
    expect(await heading('Triagem por título e resumo concluída')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir para texto completo' }));

    expect(await heading('ConvLSTM')).toBeInTheDocument();
    expect(screen.getByText('Artigo 1 de 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /duplicado/ })).toBeNull();
  });

  it('can walk only the articles still pending', async () => {
    const service = screeningService(articles, [storedDecision(2, INCLUDED)]);
    renderGuided(service);

    await heading('ConvLSTM');
    fireEvent.click(screen.getByRole('switch', { name: 'Só pendentes' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(await heading('Attention')).toBeInTheDocument();
    expect(screen.getByText('Artigo 2 de 2')).toBeInTheDocument();
  });

  // guided.css draws both from these: the chosen label's outline (aria-pressed) and each kind's part of the bar.
  it('marks the decision taken on the article and fills the bar by kind', async () => {
    const service = screeningService(articles);
    renderGuided(service);
    expect(await heading('ConvLSTM')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '1' });
    expect(await heading('MetNet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '← Anterior' }));
    expect(await heading('ConvLSTM')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Incluso/ })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByRole('button', { name: /Excluído/ })).toHaveAttribute('aria-pressed', 'false');
    const share = (kind: string) =>
      parseFloat(
        (document.querySelector(`.guided-progress-bar .review-dot--${kind}`) as HTMLElement).style.getPropertyValue(
          '--share',
        ),
      );
    expect(share('include')).toBeCloseTo(100 / 3);
    expect(share('exclude')).toBe(0);
  });

  it('moves with the buttons, switches stage with the tabs and can review a finished stage', async () => {
    const service = screeningService(articles, [
      storedDecision(1, INCLUDED),
      storedDecision(2, INCLUDED),
      storedDecision(3, INCLUDED),
    ]);
    renderGuided(service);

    expect(await heading('Triagem por título e resumo concluída')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rever todos desta etapa' }));
    expect(await heading('ConvLSTM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pular →' }));
    expect(await heading('MetNet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Anterior' }));
    expect(await heading('ConvLSTM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Texto completo' }));

    expect(await screen.findByText('Artigo 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('Sem PDF anexado.')).toBeInTheDocument();
  });

  // Validation of epic #44: opening the PDF at full text and going back landed on the project page, and the
  // guided screening started over from the first article of the title stage.
  it('opens the PDF telling the reader to come back here, and comes back on the same article and stage', async () => {
    const service = screeningService(articles, [
      storedDecision(1, INCLUDED),
      storedDecision(2, INCLUDED),
      storedDecision(3, INCLUDED),
    ]);
    renderGuided(service);
    fireEvent.click(await screen.findByRole('tab', { name: 'Texto completo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pular →' }));
    expect(await heading('MetNet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Abrir o artigo' }));
    expect(JSON.parse(screen.getByTestId('reader').textContent!)).toEqual({
      backTo: { path: '/projects/1/review/guided', label: 'Voltar à triagem guiada' },
    });

    cleanup();
    renderGuided(service);
    expect(await heading('MetNet')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Texto completo' })).toHaveAttribute('aria-selected', 'true');
  });
});
