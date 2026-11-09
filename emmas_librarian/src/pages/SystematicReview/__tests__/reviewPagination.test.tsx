import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SystematicReviewPage } from '../SystematicReviewPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import { EXCLUDED, INCLUDED, MAYBE, reviewArticle, screeningService, storedDecision } from './screeningTestData';
import { FakeDialogsProvider } from '../../../components/common/dialogs/__tests__/fakes/FakeDialogs';

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });

async function openReview(service: FakeProjectService) {
  render(
    <MemoryRouter initialEntries={['/projects/1/review']}>
      <ServicesProvider apiService={service}>
        <FakeDialogsProvider>
          <Routes>
            <Route path="/projects/:id/review" element={<SystematicReviewPage />} />
          </Routes>
        </FakeDialogsProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
  await settle();
}

const articles = (from: number, count: number, name: string) =>
  Array.from({ length: count }, (_, i) => reviewArticle(from + i, `${name} ${i + 1}`));

const rowsIn = (region: HTMLElement) => within(region).queryAllByTestId('review-row');

// getByRole walks the accessibility tree of the whole page, which is slow in jsdom with hundreds of rows; these look
// for buttons by their text instead, which is what makes the tests take seconds, not the app.
const buttonIn = (root: HTMLElement, text: string) => within(root).getByText(text, { selector: 'button' });
const regionNamed = (name: string) => document.querySelector(`section[aria-label="${name}"]`) as HTMLElement;

describe('the review page pages each group on its own (validation of epic #44)', () => {
  // 120 included, 60 in doubt, 55 excluded; 1010 undecided make the 1245 articles of the validation. The other tests
  // keep 120 undecided, enough for three pages: rendering 1245 rows in jsdom is slow, and the scale is the first test's.
  const included = articles(1, 120, 'Incluído');
  const doubt = articles(1001, 60, 'Dúvida');
  const excluded = articles(2001, 55, 'Excluído');
  const service = (undecided = 120) => {
    const pending = articles(3001, undecided, 'Pendente');
    return screeningService(
      [...included, ...doubt, ...excluded.map((a) => ({ ...a, status: 'archived' as const })), ...pending],
      [
        ...included.map((a) => storedDecision(a.id, INCLUDED)),
        ...doubt.map((a) => storedDecision(a.id, MAYBE)),
        ...excluded.map((a) => storedDecision(a.id, EXCLUDED)),
      ],
    );
  };

  it('shows at most one page of each group, and every group shows, with the 1245 articles of the validation', async () => {
    await openReview(service(1010));

    expect(rowsIn(regionNamed('Incluso (120)'))).toHaveLength(50);
    expect(rowsIn(regionNamed('Em dúvida (60)'))).toHaveLength(50);
    expect(rowsIn(regionNamed('Excluídos (55)'))).toHaveLength(50);
    expect(screen.getAllByTestId('review-row')).toHaveLength(200);
  }, 30000);

  it('turns the pages of one group, leaving the others where they are', async () => {
    await openReview(service());
    const inclusion = regionNamed('Incluso (120)');

    fireEvent.click(within(inclusion).getByLabelText('Página 3'));

    expect(rowsIn(inclusion)).toHaveLength(20);
    expect(within(inclusion).getByText('Incluído 101')).toBeInTheDocument();
    expect(within(inclusion).getByLabelText('Página 3')).toHaveAttribute('aria-current', 'page');
    expect(within(regionNamed('Em dúvida (60)')).getByText('Dúvida 1')).toBeInTheDocument();
  });

  it('pages the undecided, and "Selecionar todos" takes them all, not one page', async () => {
    const svc = service();
    await openReview(svc);

    expect(screen.getByLabelText('Páginas de Sem decisão')).toBeInTheDocument();
    fireEvent.click(buttonIn(document.body, 'Selecionar'));
    fireEvent.click(buttonIn(document.body, 'Selecionar todos'));

    expect(screen.getByText('120 selecionados')).toBeInTheDocument();
  });

  it('shows no pages for a group that fits in one', async () => {
    await openReview(screeningService(articles(1, 3, 'Pouco'), [storedDecision(1, INCLUDED)]));

    expect(screen.queryByRole('navigation', { name: /Páginas de/ })).not.toBeInTheDocument();
  });
});
