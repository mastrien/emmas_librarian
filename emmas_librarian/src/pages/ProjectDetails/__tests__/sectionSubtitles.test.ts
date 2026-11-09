import { describe, it, expect } from 'vitest';
import { articlesSubtitle, countSubtitle, overviewSubtitle } from '../components/sectionSubtitles';
import type { Article } from '../../../types';

const article = (extra: Partial<Article>): Article => ({ id: 1, project_id: 1, title: 'A', ...extra }) as Article;

describe('articlesSubtitle', () => {
  it('counts every article, the read ones and those with a PDF', () => {
    const articles = [
      article({ status: 'read', local_file_path: 'a.pdf' }),
      article({ status: 'new' }),
      article({ status: 'archived', local_file_path: 'b.pdf' }),
    ];

    expect(articlesSubtitle(articles)).toBe('3 no projeto · 1 lido · 2 com PDF');
  });

  it('reads well for an empty project', () => {
    expect(articlesSubtitle([])).toBe('0 no projeto · 0 lidos · 0 com PDF');
  });
});

describe('overviewSubtitle', () => {
  it('gives the creation date in Brazilian format and the article count', () => {
    const project = { id: 1, name: 'Tese', created_at: '2026-08-06T12:00:00Z' };

    expect(overviewSubtitle(project, 1)).toBe('Criado em 06/08/2026 · 1 artigo');
  });
});

describe('countSubtitle', () => {
  it('picks singular or plural', () => {
    expect(countSubtitle(1, 'categoria', 'categorias')).toBe('1 categoria');
    expect(countSubtitle(4, 'categoria', 'categorias')).toBe('4 categorias');
  });
});
