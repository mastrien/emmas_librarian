import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { SystematicReviewPage } from '../../SystematicReviewPage';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import { prismaService } from './prismaTestData';

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
    expect(await screen.findByText('2 aguardando decisões')).toBeInTheDocument();
    expect(screen.getByText('1 podem ser parciais')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Registros identificados \(n = 0\)/ })).not.toBeInTheDocument();
  });

  it('says where a number comes from, that the screening is under way, and lists the articles behind it', async () => {
    renderPrisma(prismaService());

    fireEvent.click(await screen.findByRole('button', { name: /^Registros triados \(n = 3\)/ }));

    expect(within(panel()).getByRole('heading', { name: 'Registros triados' })).toBeInTheDocument();
    expect(within(panel()).getByRole('note')).toHaveTextContent('Triagem em andamento: 1 artigo(s)');
    expect(within(panel()).getByRole('list', { name: 'Artigos' })).toHaveTextContent('Estudo 3');
  });

  it('lists the searches behind the identification and flags the base that hit its limit', async () => {
    renderPrisma(prismaService());

    const searches = await within(
      await screen.findByRole('complementary', { name: 'De onde vem o número' }),
    ).findByRole('list', { name: 'Buscas' });

    expect(searches).toHaveTextContent('Busca #1 · 12/09/2026 · Scopus (limite atingido)');
  });

  it('draws the "other methods" column and takes where each article came from, no number typed', async () => {
    const service = prismaService(true);
    renderPrisma(service);

    fireEvent.click(await screen.findByRole('button', { name: /^Registros identificados \(n = 2\)/ }));
    expect(within(panel()).getByRole('note')).toHaveTextContent('2 artigo(s) ainda sem origem informada');
    expect(within(panel()).getAllByText('Adição manual de artigo avulso')).toHaveLength(2);

    fireEvent.click(within(panel()).getByRole('button', { name: '+ Nova fonte' }));
    fireEvent.change(within(panel()).getByRole('textbox', { name: 'Nome' }), { target: { value: 'Google Scholar' } });
    fireEvent.change(within(panel()).getByRole('combobox', { name: 'Método' }), { target: { value: 'websites' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Salvar fonte' }));
    await within(panel()).findByText('Google Scholar');

    fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Selecionar Estudo 4' }));
    fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Selecionar Estudo 5' }));
    const bulk = within(panel()).getByRole('combobox', { name: /Marcar os selecionados \(2\) como/ });
    fireEvent.change(bulk, { target: { value: '1' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByRole('button', { name: /Sites e buscadores \(n = 2\)/ })).toBeInTheDocument();
    expect(service.setPrismaOrigins).toHaveBeenCalledWith(1, [4, 5], 1);
  });

  it('counts studies from publications marked as of the same study', async () => {
    const service = prismaService(true);
    renderPrisma(service);

    fireEvent.click(await screen.findByRole('button', { name: /^Estudos incluídos na revisão \(n = 2\)/ }));
    fireEvent.change(within(panel()).getByRole('combobox', { name: 'Publicação' }), { target: { value: '2' } });
    fireEvent.change(within(panel()).getByRole('combobox', { name: 'é do mesmo estudo que' }), {
      target: { value: '4' },
    });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Marcar como mesmo estudo' }));

    expect(await screen.findByRole('button', { name: /^Estudos incluídos na revisão \(n = 1\)/ })).toBeInTheDocument();
    expect(within(panel()).getByText('1 estudo, 2 publicações')).toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(service.unlinkStudy).toHaveBeenCalledWith(1, 2));
  });

  it('exports the diagram with both tables and says where it was saved', async () => {
    const service = prismaService();
    renderPrisma(service);

    fireEvent.click(await screen.findByRole('button', { name: 'Exportar ▾' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /SVG \+ tabelas/ }));

    expect(
      await screen.findByText('Diagrama salvo em /out/prisma.svg, com as duas tabelas ao lado.'),
    ).toBeInTheDocument();
    const [, format, , tables] = service.exportPrismaDiagram.mock.calls[0];
    expect(format).toBe('svg');
    expect(tables.excluded.split('\n')[0]).toBe('"Referência","Etapa","Motivo","Origem"');
  });

  it('shows the data table and the list of excluded reports that go with the export', async () => {
    renderPrisma(prismaService());

    const table = await screen.findByRole('region', { name: 'Tabela de dados' });

    expect(
      within(table).getByRole('row', {
        name: /^Bases de dados e repositórios Registros removidos antes da triagem 6 /,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Publicações excluídas e não recuperadas' })).toHaveTextContent(
      'Nenhuma publicação excluída no texto completo ainda.',
    );
  });
});
