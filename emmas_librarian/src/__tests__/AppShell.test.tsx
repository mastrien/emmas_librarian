import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../AppShell';
import { ServicesProvider } from '../contexts/ServicesContext';
import { GlobalErrorProvider } from '../contexts/GlobalErrorContext';
import { useInvestigationRunContext } from '../contexts/InvestigationRunContext';
import { FakeProjectService } from '../services/__tests__/fakes/FakeProjectService';
import type { Article } from '../types';

const ARTICLE = { id: 1, project_id: 3, title: 'Artigo', local_file_path: 'a.pdf' } as Article;

// Starts a run and says how it is going, as the investigation page does.
const RunProbe: React.FC = () => {
  const { run, start } = useInvestigationRunContext();
  return (
    <>
      <button
        type="button"
        onClick={() => void start({ projectId: 3, articles: [ARTICLE], questions: ['Q'], selectedIds: [1] })}
      >
        Começar
      </button>
      <span>{run?.isRunning ? `Rodando: artigo ${run.current}` : 'Nada rodando'}</span>
      <Link to="/articles/1">Abrir o PDF</Link>
    </>
  );
};

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });

describe('AppShell', () => {
  // Validation of epic #44: going to the reader and back lost the screen of a running investigation.
  it('keeps a running investigation through the PDF reader and back', async () => {
    const service = new FakeProjectService();
    service.massiveExtraction.mockImplementation(() => new Promise(() => undefined));
    render(
      <MemoryRouter initialEntries={['/investigacao']}>
        <ServicesProvider apiService={service}>
          <GlobalErrorProvider>
            <AppShell>
              <Routes>
                <Route path="/investigacao" element={<RunProbe />} />
                <Route path="/articles/:id" element={<Link to="/investigacao">Voltar</Link>} />
              </Routes>
            </AppShell>
          </GlobalErrorProvider>
        </ServicesProvider>
      </MemoryRouter>,
    );
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    await settle();
    expect(screen.getByText('Rodando: artigo 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Abrir o PDF' }));
    await settle();
    fireEvent.click(screen.getByRole('link', { name: 'Voltar' }));
    await settle();

    expect(screen.getByText('Rodando: artigo 1')).toBeInTheDocument();
    expect(service.massiveExtraction).toHaveBeenCalledTimes(1);
  });
});
