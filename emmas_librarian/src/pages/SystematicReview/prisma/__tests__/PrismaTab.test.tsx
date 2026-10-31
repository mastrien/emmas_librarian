import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { SystematicReviewPage } from '../../SystematicReviewPage';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import { prismaService } from './prismaTestData';

// Each action goes through the service and a reload; under the coverage run in CI that can take over the default 1 s.
configure({ asyncUtilTimeout: 4000 });

function renderPrisma(service: FakeProjectService, path = '/projects/1/review/prisma') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider apiService={service}>
        <Routes>
          <Route path="/projects/:id/review" element={<SystematicReviewPage />} />
          <Route path="/projects/:id/review/prisma" element={<SystematicReviewPage tab="prisma" />} />
        </Routes>
      </ServicesProvider>
    </MemoryRouter>,
  );
}

const panel = () => screen.getByRole('complementary', { name: 'De onde vem o número' });

describe('PrismaTab (#50)', () => {
  it('opens from the screening tab and shows the diagram with its warnings counted', async () => {
    renderPrisma(prismaService(), '/projects/1/review');

    fireEvent.click(await screen.findByRole('link', { name: 'Diagrama PRISMA' }));

    expect(await screen.findByRole('img', { name: 'Diagrama PRISMA 2020 da revisão' })).toBeInTheDocument();
    // Title: 1 article still in doubt; full text: the included one has no decision yet.
    expect(await screen.findByText('2 não fecham')).toBeInTheDocument();
    expect(screen.getByText('1 podem ser parciais')).toBeInTheDocument();
  });

  it('says where a number comes from and lists the articles behind it', async () => {
    renderPrisma(prismaService());

    fireEvent.click(await screen.findByRole('button', { name: /^Registros triados \(n = 3\)/ }));

    expect(within(panel()).getByRole('heading', { name: 'Registros triados' })).toBeInTheDocument();
    expect(within(panel()).getByRole('note')).toHaveTextContent('1 sem decisão ou em dúvida no título e resumo');
    expect(within(panel()).getByRole('list', { name: 'Artigos' })).toHaveTextContent('Estudo 3');
  });

  it('lists the searches behind the identification and flags the base that hit its limit', async () => {
    renderPrisma(prismaService());

    const searches = await within(
      await screen.findByRole('complementary', { name: 'De onde vem o número' }),
    ).findByRole('list', { name: 'Buscas' });

    expect(searches).toHaveTextContent('Busca #1 · 12/09/2026 · Scopus (limite atingido)');
  });

  it('takes a hand-typed number of records from other sources, dated, and goes back to the app count', async () => {
    const service = prismaService();
    renderPrisma(service);

    const input = await within(await screen.findByRole('complementary', { name: 'De onde vem o número' })).findByRole(
      'spinbutton',
      { name: 'Registros de outras fontes' },
    );
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Salvar' }));

    expect(await within(panel()).findByText('Editado manualmente em 31/10/2026.')).toBeInTheDocument();
    expect(service.setPrismaManualCount).toHaveBeenCalledWith(1, 'other_sources', 4);
    fireEvent.click(within(panel()).getByRole('button', { name: /Voltar à contagem do app/ }));
    await waitFor(() => expect(service.setPrismaManualCount).toHaveBeenLastCalledWith(1, 'other_sources', null));
  });

  it('exports the diagram with its table and says where it was saved', async () => {
    const service = prismaService();
    renderPrisma(service);

    fireEvent.click(await screen.findByRole('button', { name: 'Exportar ▾' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /SVG \+ tabela de dados/ }));

    expect(
      await screen.findByText('Diagrama salvo em /out/prisma.svg, com a tabela de dados ao lado.'),
    ).toBeInTheDocument();
    expect(service.exportPrismaDiagram.mock.calls[0][1]).toBe('svg');
  });

  it('shows the data table that goes with the export', async () => {
    renderPrisma(prismaService());

    const table = await screen.findByRole('region', { name: 'Tabela de dados' });

    expect(within(table).getByRole('row', { name: /^Registros removidos antes da triagem 6 / })).toBeInTheDocument();
  });
});
