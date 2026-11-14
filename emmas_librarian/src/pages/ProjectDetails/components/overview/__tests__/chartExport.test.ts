import { describe, expect, it } from 'vitest';
import type { Article } from '../../../../../types';
import { chartsSvg } from '../chartExport';

const article = (over: Partial<Article>): Article => ({ id: 1, title: 'A', status: 'new', ...over }) as Article;

describe('chartsSvg', () => {
  it('draws the three charts of the overview in one standalone SVG', () => {
    const svg = chartsSvg([
      article({ year: 2019, publisher: 'Wiley', source_databases: JSON.stringify(['OpenAlex']) }),
      article({ id: 2, year: 2021, publisher: 'Nature Portfolio' }),
    ]);

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('Artigos por ano');
    expect(svg).toContain('Bases de origem');
    expect(svg).toContain('Editoras');
    expect(svg).toContain('Wiley');
  });

  it('puts the first and the last year under the bars', () => {
    const svg = chartsSvg([article({ year: 2019 }), article({ id: 2, year: 2021 })]);

    expect(svg).toContain('>2019</text>');
    expect(svg).toContain('>2021</text>');
  });

  it('escapes what comes from the articles, so a publisher cannot break the document', () => {
    const svg = chartsSvg([article({ publisher: 'A & B <Press>' })]);

    expect(svg).toContain('A &amp; B &lt;Press&gt;');
    expect(svg).not.toContain('<Press>');
  });

  it('still produces a valid document for a project with no articles', () => {
    expect(chartsSvg([])).toMatch(/^<svg .*<\/svg>$/);
  });
});
