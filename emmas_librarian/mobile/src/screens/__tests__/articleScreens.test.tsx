import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import type { ProjectCategory } from '../../../../src/types';
import type { PdfPages } from '../../pdf/pdfDocument';
import { categoryText, valueFor } from '../CategoryFields';
import { anArticle, FakeProjectReader } from './fakes/FakeProjectReader';
import { renderLibrary } from './fakes/renderLibrary';

const address = () => screen.getByTestId('address').textContent;
const category = (fields: Partial<ProjectCategory> & { id: number; name: string; type: string }): ProjectCategory => ({
  project_id: 1,
  ...fields,
});
const METHOD = category({
  id: 10,
  name: 'Método',
  type: 'enum',
  parsedOptions: [
    { id: 1, name: 'Survey' },
    { id: 2, name: 'Estudo de caso' },
  ],
});
const TAGS = category({ id: 11, name: 'Temas', type: 'multiselect', parsedOptions: METHOD.parsedOptions });
const NOTE = category({ id: 12, name: 'Observação', type: 'text' });

describe('categoryText and valueFor', () => {
  it('shows the chosen options, the text, or a dash', () => {
    expect(categoryText({ category_id: 1, name: 'x', type: 'enum', option_names: ['Survey', 'Outro'] })).toBe(
      'Survey, Outro',
    );
    expect(categoryText({ category_id: 1, name: 'x', type: 'text', value: ' reler ' })).toBe('reler');
    expect(categoryText(undefined)).toBe('—');
  });

  it('prefers the chosen options over an old free-text value of the same category', () => {
    const old = { category_id: 10, name: 'Método', type: 'enum', value: 'x' };
    const chosen = { category_id: 10, name: 'Método', type: 'enum', option_ids: [1], option_names: ['Survey'] };

    expect(valueFor([old, chosen], METHOD)).toBe(chosen);
    expect(valueFor([old], METHOD)).toBe(old);
    expect(valueFor([], METHOD)).toBeUndefined();
  });
});

describe('ArticleScreen', () => {
  let reader: FakeProjectReader;

  beforeEach(() => {
    reader = new FakeProjectReader();
    reader.articles.push(
      anArticle({
        id: 5,
        title: 'Revisão sistemática',
        authors: 'Silva, A.',
        year: 2021,
        journal: 'Revista X',
        doi: '10.1/abc',
        abstract: 'Resumo do artigo.',
        local_file_path: '/pdfs/a.pdf',
      }),
      anArticle({ id: 6, title: 'Sem arquivo' }),
    );
  });

  it('shows the metadata, the abstract and the DOI link, and leads to the PDF and back to the project', async () => {
    renderLibrary(reader, '/articles/5');

    expect(await screen.findByRole('heading', { name: 'Revisão sistemática' })).toBeInTheDocument();
    expect(screen.getByText('Silva, A. · 2021 · Revista X')).toBeInTheDocument();
    expect(screen.getByText('Resumo do artigo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'doi:10.1/abc' })).toHaveAttribute('href', 'https://doi.org/10.1/abc');
    expect(screen.getByRole('link', { name: 'Abrir PDF' })).toHaveAttribute('href', '/articles/5/pdf');
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/projects/1');
  });

  it('says an article has no PDF, and nothing marked', async () => {
    renderLibrary(reader, '/articles/6');

    expect(await screen.findByText('Este artigo não tem PDF.')).toBeInTheDocument();
    expect(screen.getByText('Nada marcado neste artigo.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Categorias' })).not.toBeInTheDocument();
  });

  it('says an article was not found', async () => {
    renderLibrary(reader, '/articles/404');

    expect(await screen.findByText('Artigo não encontrado.')).toBeInTheDocument();
  });

  it('lists each highlight with its note and a link to its page, and the loose notes once', async () => {
    reader.annotations.push(
      { id: 1, article_id: 5, content_markdown: 'nota do trecho', created_at: '' },
      { id: 2, article_id: 5, content_markdown: 'nota solta', created_at: '' },
    );
    reader.highlights.push({
      id: '9',
      article_id: 5,
      color: '#ffd400',
      content_text: 'trecho marcado',
      position_data: '{"boundingRect":{"pageNumber":4}}',
      annotation_id: 1,
      comment: 'nota do trecho',
    });
    renderLibrary(reader, '/articles/5');

    const marked = (await screen.findByText('trecho marcado')).closest('li')!;
    expect(within(marked).getByText('nota do trecho')).toBeInTheDocument();
    expect(marked).toHaveStyle({ borderLeftColor: '#ffd400' });
    expect(screen.getAllByText('nota do trecho')).toHaveLength(1);
    expect(screen.getByText('nota solta')).toBeInTheDocument();
    expect(within(marked).getByRole('link', { name: 'Página 4' })).toHaveAttribute('href', '/articles/5/pdf?page=4');
  });

  describe('categories', () => {
    beforeEach(() => {
      reader.categories.push(METHOD, TAGS, NOTE);
      reader.articleCategories.push(
        { article_id: 5, category_id: 10, name: 'Método', type: 'enum', option_ids: [1], option_names: ['Survey'] },
        { article_id: 5, category_id: 12, name: 'Observação', type: 'text', value: 'reler' },
      );
    });

    it('chooses one option of a single-choice category', async () => {
      renderLibrary(reader, '/articles/5');
      const field = await screen.findByLabelText('Método');
      expect(field).toHaveValue('1');

      fireEvent.change(field, { target: { value: '2' } });

      await waitFor(() => expect(reader.written).toEqual(['setArticleCategory(5, 10, 2)']));
    });

    it('clears a single-choice category', async () => {
      renderLibrary(reader, '/articles/5');

      fireEvent.change(await screen.findByLabelText('Método'), { target: { value: '' } });

      await waitFor(() => expect(reader.written).toEqual(['setArticleCategory(5, 10, null)']));
    });

    it('adds an option of a several-choices category, as ids joined by commas', async () => {
      reader.articleCategories.push({
        article_id: 5,
        category_id: 11,
        name: 'Temas',
        type: 'multiselect',
        option_ids: [1],
        option_names: ['Survey'],
      });
      renderLibrary(reader, '/articles/5');
      const themes = await screen.findByRole('group', { name: 'Temas' });
      expect(within(themes).getByLabelText('Survey')).toBeChecked();

      fireEvent.click(within(themes).getByLabelText('Estudo de caso'));

      await waitFor(() => expect(reader.written).toEqual(['setArticleCategory(5, 11, 1,2)']));
    });

    it('saves a text category when the field is left, and only if it changed', async () => {
      renderLibrary(reader, '/articles/5');
      const field = await screen.findByLabelText('Observação');

      fireEvent.blur(field);
      expect(reader.written).toEqual([]);
      fireEvent.change(field, { target: { value: 'citar na introdução' } });
      fireEvent.blur(field);

      await waitFor(() => expect(reader.written).toEqual(['setArticleCategory(5, 12, citar na introdução)']));
    });

    it('shows the values as text in a file, with nothing to change', async () => {
      const file = new FakeProjectReader(false);
      Object.assign(file, {
        articles: reader.articles,
        categories: reader.categories,
        articleCategories: reader.articleCategories,
      });
      renderLibrary(file, '/articles/5');

      expect(await screen.findByText('Survey')).toBeInTheDocument();
      expect(screen.getByText('reler')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });
});

/** An open PDF that draws nothing: records which pages were asked for, and whether it was closed. */
class FakePdf implements PdfPages {
  pageRatio = 1.4;
  drawn: number[] = [];
  closed = false;
  failOnPage: number | null = null;

  constructor(readonly pageCount: number) {}

  async renderPage(pageNumber: number): Promise<void> {
    if (pageNumber === this.failOnPage) throw new Error('página corrompida');
    this.drawn.push(pageNumber);
  }

  close(): void {
    this.closed = true;
  }
}

describe('PdfScreen', () => {
  let reader: FakeProjectReader;
  let pdf: FakePdf;
  let opened: Uint8Array[];
  const openPdf = async (bytes: Uint8Array) => {
    opened.push(bytes);
    return pdf;
  };

  beforeEach(() => {
    reader = new FakeProjectReader();
    reader.articles.push(anArticle({ id: 5, title: 'A', local_file_path: '/a.pdf' }));
    reader.pdfs.set(5, new Uint8Array([37, 80, 68, 70]));
    pdf = new FakePdf(3);
    opened = [];
  });

  // jsdom has no IntersectionObserver, so every page is drawn at once; a browser draws them as they come near.
  it("opens the article's PDF and draws its pages, with room reserved by the page's proportions", async () => {
    renderLibrary(reader, '/articles/5/pdf', { openPdf });

    const pages = await screen.findAllByRole('figure');
    expect(pages.map((page) => page.getAttribute('aria-label'))).toEqual(['Página 1', 'Página 2', 'Página 3']);
    await waitFor(() => expect(pdf.drawn.sort()).toEqual([1, 2, 3]));
    expect(opened).toEqual([new Uint8Array([37, 80, 68, 70])]);
    const canvas = pages[0].querySelector('canvas')!;
    expect(parseFloat(canvas.style.height) / parseFloat(canvas.style.width)).toBeCloseTo(1.4);
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/articles/5');
  });

  it('says when one page cannot be drawn and still draws the others', async () => {
    pdf.failOnPage = 2;
    renderLibrary(reader, '/articles/5/pdf', { openPdf });

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível desenhar a página 2.');
    expect(pdf.drawn.sort()).toEqual([1, 3]);
  });

  it('says when the article has no PDF here', async () => {
    reader.pdfs.clear();
    renderLibrary(reader, '/articles/5/pdf', { openPdf });

    expect(await screen.findByText('Este artigo não tem PDF disponível aqui.')).toBeInTheDocument();
    expect(opened).toEqual([]);
  });

  it('closes the PDF when the screen is left', async () => {
    const view = renderLibrary(reader, '/articles/5/pdf', { openPdf });
    await screen.findAllByRole('figure');
    await waitFor(() => expect(pdf.drawn).toHaveLength(3));

    view.unmount();

    expect(pdf.closed).toBe(true);
    expect(address).toBeDefined();
  });
});
