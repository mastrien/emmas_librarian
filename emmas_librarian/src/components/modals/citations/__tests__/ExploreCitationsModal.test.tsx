import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import type { Article, CitationSeedCount } from '../../../../types';
import { citationSeedOf, NO_CITATION_LOOKUP } from '../../../../utils/citationSeeds';
import { ExploreCitationsModal } from '../ExploreCitationsModal';

const article = (id: number, extra: Partial<Article> = {}) =>
  ({ id, project_id: 3, title: `Artigo ${id}`, status: 'new', doi: `10.1/${id}`, ...extra }) as Article;
const count = (id: number, references = 30, citedBy = 8, found = true): CitationSeedCount => ({
  articleId: id,
  title: `Artigo ${id}`,
  found,
  references,
  citedBy,
});

function open(articles: Article[], counts: CitationSeedCount[] = [count(1)]) {
  const service = new FakeProjectService();
  service.peekCitations.mockResolvedValue(counts);
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <ServicesProvider apiService={service}>
      <ExploreCitationsModal projectId={3} articles={articles} onClose={onClose} onSaved={onSaved} />
    </ServicesProvider>,
  );
  return { service, onClose, onSaved };
}

const search = () => screen.getByRole('button', { name: 'Buscar' });

describe('citationSeedOf', () => {
  it('uses the OpenAlex id the article came with, and its DOI', () => {
    const csl = JSON.stringify({ id: 'https://openalex.org/W7' });

    expect(citationSeedOf(article(1, { csl_json: csl } as never))).toEqual({
      articleId: 1,
      title: 'Artigo 1',
      openAlexId: 'https://openalex.org/W7',
      doi: '10.1/1',
    });
  });

  it('ignores an id from another base and malformed metadata', () => {
    expect(citationSeedOf(article(1, { csl_json: '{"id":"scopus:9"}' } as never))?.openAlexId).toBeUndefined();
    expect(citationSeedOf(article(1, { csl_json: '{oops' } as never))?.openAlexId).toBeUndefined();
  });

  it('has nothing to go on without either', () => {
    expect(citationSeedOf(article(1, { doi: '  ' } as never))).toBeNull();
  });
});

describe('ExploreCitationsModal (#51)', () => {
  it('says how much there is before downloading anything', async () => {
    const { service } = open([article(1)]);

    expect(await screen.findByText('Cita 30 trabalhos · citado por 8')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('São 30 trabalhos.');
    expect(service.previewCitations).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Citações/ }));
    expect(screen.getByRole('status')).toHaveTextContent('São 38 trabalhos.');
  });

  it('warns when the volume is above the limit', async () => {
    open([article(1)], [count(1, 500)]);

    expect(await screen.findByText('São 500 trabalhos; só os 200 primeiros serão baixados.')).toBeInTheDocument();
  });

  it('shows the reason, and cannot search, when an article has no way to be found', () => {
    const { service } = open([article(1, { doi: null } as never)]);

    expect(screen.getByRole('note')).toHaveTextContent(NO_CITATION_LOOKUP);
    expect(search()).toBeDisabled();
    expect(service.peekCitations).not.toHaveBeenCalled();
  });

  it('explores the rest of a selection, saying what stayed out', async () => {
    const { service } = open([article(1), article(2, { doi: null } as never)]);

    expect(screen.getByRole('note')).toHaveTextContent('1 artigo fica de fora.');
    await screen.findByText('Artigo 1');
    expect(service.peekCitations.mock.calls[0][0].map((s) => s.articleId)).toEqual([1]);
  });

  it('says when OpenAlex does not know the article, and leaves it out of the search', async () => {
    const { service } = open([article(1), article(2)], [count(1), count(2, 0, 0, false)]);

    expect(await screen.findByText('O OpenAlex não encontrou este artigo.')).toBeInTheDocument();
    fireEvent.click(search());

    await waitFor(() => expect(service.previewCitations).toHaveBeenCalled());
    expect(service.previewCitations.mock.calls[0][1].seeds.map((s) => s.articleId)).toEqual([1]);
  });

  it('cannot search without a direction, with nothing to find, or with an invalid limit', async () => {
    open([article(1)], [count(1, 0, 3)]);

    await screen.findByText(/Cita 0/);
    expect(search()).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Citações/ }));
    expect(search()).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Baixar no máximo'), { target: { value: '5000' } });
    expect(search()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Escolha um número de 1 a 1000.');
  });

  it('opens the same preview of a search, and saving reloads the project', async () => {
    const { service, onClose, onSaved } = open([article(1)]);
    await screen.findByText(/Cita 30/);

    fireEvent.click(search());

    expect(await screen.findByRole('dialog', { name: 'Busca Concluída' })).toBeInTheDocument();
    expect(service.previewCitations).toHaveBeenCalledWith(3, {
      seeds: [{ articleId: 1, title: 'Artigo 1', openAlexId: undefined, doi: '10.1/1' }],
      directions: ['references'],
      limit: 200,
    });
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Busca Concluída' })).getByRole('button', {
        name: /^(Salvar|Concluir)/,
      }),
    );
    await waitFor(() => expect(service.saveSearchPreview).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('discarding the preview goes back to the choices, keeping the project untouched', async () => {
    const { service, onSaved } = open([article(1)]);
    await screen.findByText(/Cita 30/);
    fireEvent.click(search());

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));

    expect(service.discardSearchPreview).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('dialog', { name: 'Explorar citações' })).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shows a failure in the dialog', async () => {
    const service = new FakeProjectService();
    service.peekCitations.mockRejectedValue(new Error('429 do OpenAlex'));
    render(
      <ServicesProvider apiService={service}>
        <ExploreCitationsModal projectId={3} articles={[article(1)]} onClose={vi.fn()} onSaved={vi.fn()} />
      </ServicesProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('429 do OpenAlex');
    expect(search()).toBeDisabled();
  });

  it('closes on its X', () => {
    const { onClose } = open([article(1, { doi: null } as never)]);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(onClose).toHaveBeenCalled();
  });
});
