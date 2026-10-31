import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { GuidedScreeningPage } from '../GuidedScreeningPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import { DUPLICATE, EXCLUDED, INCLUDED, reviewArticle, screeningService, storedDecision } from './screeningTestData';

function renderGuided(service: FakeProjectService) {
  render(
    <MemoryRouter initialEntries={['/projects/1/review/guided']}>
      <ServicesProvider apiService={service}>
        <Routes>
          <Route path="/projects/:id/review/guided" element={<GuidedScreeningPage />} />
        </Routes>
      </ServicesProvider>
    </MemoryRouter>,
  );
}

const articles = [reviewArticle(1, 'ConvLSTM'), reviewArticle(2, 'MetNet'), reviewArticle(3, 'Attention')];
// Each decision goes through the service and a reload; under the coverage run in CI that took over the default 1 s.
configure({ asyncUtilTimeout: 4000 });

const heading = (title: string) => screen.findByRole('heading', { name: title, level: 2 });

describe('GuidedScreeningPage (#49)', () => {
  it('shows one article with its abstract and decides it with a key, moving to the next', async () => {
    const service = screeningService(articles);
    renderGuided(service);

    expect(await heading('ConvLSTM')).toBeInTheDocument();
    expect(screen.getByText('Resumo de ConvLSTM')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '1' });

    await waitFor(() => expect(service.decideScreening).toHaveBeenCalledWith([1], INCLUDED, 'title', null));
    expect(await heading('MetNet')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Só pendentes' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(await heading('Attention')).toBeInTheDocument();
    expect(screen.getByText('Artigo 2 de 2')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Próximo →' }));
    expect(await heading('MetNet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Anterior' }));
    expect(await heading('ConvLSTM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Texto completo' }));

    expect(await screen.findByText('Artigo 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('Sem PDF anexado.')).toBeInTheDocument();
  });
});
