import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectDetailsPage } from '../../ProjectDetailsPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { GlobalErrorProvider, useGlobalError } from '../../../contexts/GlobalErrorContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import type { Article } from '../../../types';

/**
 * Shared setup for ProjectDetailsPage characterization tests: renders the real
 * page (and real children) at /projects/1 against a FakeProjectService, with a
 * probe that exposes whatever reached the global error modal.
 *
 * Usage:
 *   const service = givenProject([article({ id: 1, title: 'A' })]);
 *   await renderProjectPage(service);
 */
export const PROJECT = { id: 1, name: 'Tese', created_at: '2026-01-01' };

export function article(overrides: Partial<Article> & { id: number }): Article {
  return {
    project_id: 1,
    title: `Artigo ${overrides.id}`,
    authors: 'Ana Lima',
    year: 2020,
    source_query: 'q',
    source_databases: '["OpenAlex"]',
    csl_json: '{}',
    status: 'new',
    created_at: '2026-01-01',
    ...overrides,
  } as Article;
}

export function givenProject(articles: Article[] = []): FakeProjectService {
  const service = FakeProjectService.create();
  service.getProject.mockResolvedValue(PROJECT);
  service.getArticles.mockResolvedValue(articles);
  return service;
}

function GlobalErrorProbe(): React.ReactNode {
  const { currentError } = useGlobalError();
  return currentError ? <output data-testid="global-error">{currentError.message}</output> : null;
}

export async function renderProjectPage(service: FakeProjectService, path = '/projects/1'): Promise<void> {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider apiService={service}>
        <GlobalErrorProvider>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
            <Route path="/" element={<p>Lista de projetos</p>} />
          </Routes>
          <GlobalErrorProbe />
        </GlobalErrorProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
  await screen.findByTestId('project-details-container');
}

export const mainTable = () => screen.getByTestId('main-articles-table');
