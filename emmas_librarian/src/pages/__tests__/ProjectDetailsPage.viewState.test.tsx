import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjectDetailsPage } from '../ProjectDetailsPage';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';
import { article, givenProject } from './support/projectPageHarness';
import type { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';

// Stand-in for the PDF reader: leaving the page unmounts it, like the real navigation does.
const ReaderStub = () => <Link to="/projects/1">Voltar ao projeto</Link>;

async function renderPageWithReader(service: FakeProjectService): Promise<void> {
  render(
    <MemoryRouter initialEntries={['/projects/1']}>
      <ServicesProvider apiService={service}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
            <Route path="/articles/:id" element={<ReaderStub />} />
          </Routes>
        </GlobalErrorProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
  await screen.findByTestId('project-details-container');
}

const accordion = (label: RegExp) => screen.getByText(label).closest('details') as HTMLDetailsElement;

function expand(details: HTMLDetailsElement): void {
  details.open = true;
  fireEvent(details, new Event('toggle'));
}

describe('ProjectDetailsPage view state', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('keeps the filter and the open sections after a visit to the PDF reader', async () => {
    await renderPageWithReader(
      givenProject([
        article({ id: 1, title: 'Alfa novo' }),
        article({ id: 2, title: 'Beta lido', status: 'read' }),
        article({ id: 3, title: 'Gama arquivado', status: 'archived' }),
      ]),
    );
    fireEvent.change(screen.getByPlaceholderText('Buscar por título ou autor'), { target: { value: 'Alfa' } });
    expand(accordion(/Artigos Lidos/));
    expand(accordion(/Artigos Arquivados/));

    fireEvent.click(within(accordion(/Artigos Lidos/)).getByRole('link', { name: 'Ver' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Voltar ao projeto' }));
    await screen.findByTestId('project-details-container');

    expect(screen.getByPlaceholderText('Buscar por título ou autor')).toHaveValue('Alfa');
    expect(accordion(/Artigos Lidos/).open).toBe(true);
    expect(accordion(/Artigos Arquivados/).open).toBe(true);
  });

  it('does not carry one project view state over to another project', async () => {
    window.sessionStorage.setItem('project.2.view.searchTerm', JSON.stringify('de outro projeto'));

    await renderPageWithReader(givenProject([article({ id: 1, title: 'Alfa novo' })]));

    expect(screen.getByPlaceholderText('Buscar por título ou autor')).toHaveValue('');
  });
});
