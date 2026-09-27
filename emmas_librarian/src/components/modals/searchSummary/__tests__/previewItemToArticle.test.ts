import { describe, expect, it } from 'vitest';
import { previewItemToArticle } from '../previewItemToArticle';

describe('previewItemToArticle', () => {
  it('keeps the list fields and the metadata, with sources in the stored JSON format', () => {
    const article = previewItemToArticle({
      title: 'Ontologias',
      authors: 'Ana Lima',
      year: 2024,
      doi: '10.1/x',
      sourceDatabases: ['OpenAlex', 'Crossref'],
      alreadyInProject: false,
      details: { abstract: 'Resumo.', journal: 'Revista X', citation_count: 3 },
    });

    expect(article).toEqual({
      id: 0,
      project_id: 0,
      status: 'new',
      title: 'Ontologias',
      authors: 'Ana Lima',
      year: 2024,
      doi: '10.1/x',
      source_databases: '["OpenAlex","Crossref"]',
      abstract: 'Resumo.',
      journal: 'Revista X',
      citation_count: 3,
    });
  });
});
