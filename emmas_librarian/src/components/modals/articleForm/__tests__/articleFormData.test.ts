import { describe, it, expect } from 'vitest';
import { EMPTY_ARTICLE_FIELDS, articleFromForm, fieldsFromArticle, fillEmptyFields } from '../articleFormData';

describe('fieldsFromArticle', () => {
  it('starts from the article, with empty strings for what it lacks', () => {
    expect(fieldsFromArticle({ title: 'Radar', year: 2021 })).toEqual({
      ...EMPTY_ARTICLE_FIELDS,
      title: 'Radar',
      year: '2021',
    });
  });
});

describe('articleFromForm', () => {
  it('trims, parses the year and leaves empty optional fields undefined', () => {
    const saved = articleFromForm({
      ...EMPTY_ARTICLE_FIELDS,
      title: ' Radar ',
      authors: ' Lima ',
      year: ' 2021 ',
      doi: '  ',
    });
    expect(saved).toEqual({
      title: 'Radar',
      authors: 'Lima',
      year: 2021,
      doi: undefined,
      journal: undefined,
      volume: undefined,
      issue: undefined,
      pages: undefined,
      abstract: undefined,
    });
  });
});

describe('fillEmptyFields', () => {
  it('fills only what the person left empty', () => {
    const typed = { ...EMPTY_ARTICLE_FIELDS, title: 'Meu título', doi: '  ' };
    const filled = fillEmptyFields(typed, { title: 'Título da IA', doi: '10.1/x', year: 2020 });
    expect([filled.title, filled.doi, filled.year, filled.journal]).toEqual(['Meu título', '10.1/x', '2020', '']);
  });
});
