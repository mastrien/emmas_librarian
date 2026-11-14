import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OverviewStats } from '../OverviewStats';
import type { Article } from '../../../../../types';

const article = (id: number, extra: Partial<Article> = {}): Article =>
  ({ id, project_id: 1, title: `A${id}`, ...extra }) as Article;

const PUBLISHERS = ['Wiley', 'Elsevier', 'Springer', 'MDPI', 'IEEE'];

describe('OverviewStats', () => {
  it('shows the tiles with the open access share', () => {
    render(<OverviewStats articles={[article(1, { is_oa: 1 }), article(2, { status: 'read' })]} />);

    const tile = (label: string) => screen.getByText(label, { selector: '.overview-label' }).parentElement!;
    expect(within(tile('Artigos')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Artigos')).getByText('1 ativos')).toBeInTheDocument();
    expect(within(tile('Acesso aberto')).getByText('50%')).toBeInTheDocument();
  });

  it('describes the year range and the articles without a year', () => {
    render(<OverviewStats articles={[article(1, { year: 2019 }), article(2, { year: 2021 }), article(3)]} />);

    const years = screen.getByRole('region', { name: 'Artigos por ano' });
    expect(within(years).getByText('2019–2021 · 1 sem ano')).toBeInTheDocument();
    expect(within(years).getByRole('img', { name: 'Artigos por ano, 2019–2021' })).toBeInTheDocument();
  });

  it('lists the three biggest publishers and opens up to ten', () => {
    const articles = PUBLISHERS.map((publisher, i) => article(i, { publisher }));
    render(<OverviewStats articles={articles} />);
    const publishers = screen.getByRole('region', { name: 'Editoras' });
    expect(within(publishers).getAllByRole('listitem')).toHaveLength(3);

    fireEvent.click(within(publishers).getByRole('button', { name: 'Ver as 5 maiores' }));

    expect(within(publishers).getAllByRole('listitem')).toHaveLength(5);
  });

  it('says so when there is nothing to rank yet', () => {
    render(<OverviewStats articles={[]} />);

    expect(
      within(screen.getByRole('region', { name: 'Bases de origem' })).getByText('Nenhum dado ainda.'),
    ).toBeInTheDocument();
  });
});
