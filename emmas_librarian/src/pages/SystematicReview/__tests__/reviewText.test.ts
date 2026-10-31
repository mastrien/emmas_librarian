import { describe, it, expect } from 'vitest';
import { articleMeta, articlesCount, databasesOf, wasRead } from '../reviewText';
import type { Article, ScreeningDecision } from '../../../types';

const article = (extra: Partial<Article>): Article =>
  ({ id: 1, project_id: 1, title: 'A', status: 'new', ...extra }) as Article;

describe('reviewText (#49)', () => {
  it('writes authors, year and journal in one line, and says when the year is missing', () => {
    expect(articleMeta(article({ authors: 'Shi, X.', year: 2015, journal: 'NeurIPS' }))).toBe(
      'Shi, X. · 2015 · NeurIPS',
    );
    expect(articleMeta(article({ authors: 'Shi, X.' }))).toBe('Shi, X. · s/ ano');
  });

  it('reads the bases from a JSON list or from a comma-separated text', () => {
    expect(databasesOf(article({ source_databases: '["openalex","scopus"]' }))).toEqual(['openalex', 'scopus']);
    expect(databasesOf(article({ source_databases: 'Scopus, Web of Science' }))).toEqual(['Scopus', 'Web of Science']);
    expect(databasesOf(article({ source_databases: '' }))).toEqual([]);
  });

  it('keeps the "lido" mark of an article the triage archived after it was read', () => {
    const archived = article({ status: 'archived' });
    const decision = { status_before: 'read' } as ScreeningDecision;

    expect(wasRead({ article: archived, decision, label: null })).toBe(true);
    expect(wasRead({ article: archived, decision: null, label: null })).toBe(false);
  });

  it('counts articles in Portuguese', () => {
    expect([articlesCount(1), articlesCount(3)]).toEqual(['1 artigo', '3 artigos']);
  });
});
