import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArticleMetaLine, ArticleSummary, AuthorList } from '../ArticleCells';
import type { Article } from '../../../../../types';

const EIGHTEEN_AUTHORS = Array.from({ length: 18 }, (_, i) => `Autor${i + 1}, A.`).join('; ');

const article = (overrides: Partial<Article> = {}): Article => ({
  id: 3,
  project_id: 1,
  title: 'Radar e chuva',
  status: 'new',
  ...overrides,
});

describe('AuthorList', () => {
  it('shows the first three authors and a "+N" button with the rest', () => {
    render(<AuthorList authors={EIGHTEEN_AUTHORS} layout="column" />);

    expect(screen.getByText('Autor1, A.; Autor2, A.; Autor3, A.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar os 18 autores' })).toHaveTextContent('+15');
  });

  it('expands the whole list in place and collapses it again', () => {
    render(<AuthorList authors={EIGHTEEN_AUTHORS} layout="inline" />);

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar os 18 autores' }));
    expect(screen.getByText(/Autor18, A\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar menos autores' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menos autores' }));
    expect(screen.queryByText(/Autor18/)).not.toBeInTheDocument();
  });

  it('puts the full list in the "+N" tooltip', () => {
    render(<AuthorList authors="A, B.; C, D.; E, F.; G, H." layout="column" />);

    expect(screen.getByRole('button', { name: 'Mostrar os 4 autores' })).toHaveAttribute(
      'title',
      'A, B.; C, D.; E, F.; G, H.',
    );
  });

  it('has no button when there are three authors or fewer', () => {
    render(<AuthorList authors="Ana Silva, Bruno Costa, Carla Mendes" layout="column" />);

    expect(screen.getByText('Ana Silva; Bruno Costa; Carla Mendes')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says so when the article has no authors', () => {
    render(<AuthorList authors="" layout="column" />);

    expect(screen.getByText('Autores desconhecidos')).toBeInTheDocument();
  });
});

describe('ArticleMetaLine', () => {
  it('lists year, DOI, citations and open access', () => {
    render(<ArticleMetaLine article={article({ year: 2023, doi: '10.1/x', citation_count: 48, is_oa: 1 })} />);

    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('DOI 10.1/x')).toBeInTheDocument();
    expect(screen.getByText('48 citações')).toBeInTheDocument();
    expect(screen.getByText('Acesso aberto')).toBeInTheDocument();
  });

  it('uses the singular for one citation and names a missing year', () => {
    render(<ArticleMetaLine article={article({ citation_count: 1 })} />);

    expect(screen.getByText('1 citação')).toBeInTheDocument();
    expect(screen.getByText('Ano não informado')).toBeInTheDocument();
  });

  it('leaves out what the article does not have', () => {
    render(<ArticleMetaLine article={article({ year: 2020, is_oa: 0 })} />);

    expect(screen.queryByText(/DOI/)).not.toBeInTheDocument();
    expect(screen.queryByText(/citaç/)).not.toBeInTheDocument();
    expect(screen.queryByText('Acesso aberto')).not.toBeInTheDocument();
  });
});

describe('ArticleSummary', () => {
  it('keeps the full title in the tooltip, since long titles are clamped', () => {
    render(<ArticleSummary article={article({ title: 'Um título muito longo' })} onOpenDetails={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Um título muito longo' })).toHaveAttribute(
      'title',
      'Um título muito longo',
    );
  });

  it('opens the details on click and on Enter', () => {
    const onOpenDetails = vi.fn();
    const a = article();
    render(<ArticleSummary article={a} onOpenDetails={onOpenDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'Radar e chuva' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Radar e chuva' }), { key: 'Enter' });

    expect(onOpenDetails).toHaveBeenCalledTimes(2);
    expect(onOpenDetails).toHaveBeenCalledWith(a);
  });
});
