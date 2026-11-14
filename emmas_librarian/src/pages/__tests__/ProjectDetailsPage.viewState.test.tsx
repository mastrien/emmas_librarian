import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjectDetailsPage } from '../ProjectDetailsPage';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';
import { FakeDialogsProvider } from '../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import { article, givenProject } from './support/projectPageHarness';
import type { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';

// Stand-in for the PDF reader: leaving the page unmounts it, like the real navigation does.
const ReaderStub = () => <Link to="/projects/1">Voltar ao projeto</Link>;

async function renderPageWithReader(service: FakeProjectService): Promise<void> {
  render(
    <MemoryRouter initialEntries={['/projects/1']}>
      <ServicesProvider apiService={service}>
        <GlobalErrorProvider>
          <FakeDialogsProvider>
            <Routes>
              <Route path="/projects/:id" element={<ProjectDetailsPage />} />
              <Route path="/projects/:id/:section" element={<ProjectDetailsPage />} />
              <Route path="/articles/:id" element={<ReaderStub />} />
            </Routes>
          </FakeDialogsProvider>
        </GlobalErrorProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
  await screen.findByTestId('project-details-container');
}

const statusButton = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'Status dos artigos' })).getByRole('button', { name });

describe('ProjectDetailsPage view state', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('keeps the search and the status after a visit to the PDF reader', async () => {
    await renderPageWithReader(
      givenProject([
        article({ id: 1, title: 'Alfa novo' }),
        article({ id: 2, title: 'Beta lido', status: 'read', local_file_path: '/b.pdf' }),
        article({ id: 3, title: 'Gama lido', status: 'read' }),
      ]),
    );
    fireEvent.click(statusButton(/^Lidos/));
    fireEvent.change(screen.getByPlaceholderText('Buscar por título ou autor'), { target: { value: 'Beta' } });

    fireEvent.click(screen.getByRole('link', { name: 'Ler' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Voltar ao projeto' }));
    await screen.findByTestId('project-details-container');

    expect(screen.getByPlaceholderText('Buscar por título ou autor')).toHaveValue('Beta');
    expect(statusButton(/^Lidos/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not carry one project view state over to another project', async () => {
    window.sessionStorage.setItem('project.2.view.searchTerm', JSON.stringify('de outro projeto'));

    await renderPageWithReader(givenProject([article({ id: 1, title: 'Alfa novo' })]));

    expect(screen.getByPlaceholderText('Buscar por título ou autor')).toHaveValue('');
  });
});
