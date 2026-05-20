import { describe, it, expect } from 'vitest';
import { QueryTranslator } from '../QueryTranslator';
import { QueryBlock } from '../types';

describe('QueryTranslator', () => {
  const translator = new QueryTranslator();

  it('translates title and year to OpenAlex format', () => {
    const blocks: QueryBlock[] = [
      { id: '1', field: 'title', type: 'contains', value: 'machine learning' },
      { id: '2', field: 'year', type: 'greater_than', value: '2020' }
    ];
    const result = translator.toOpenAlex(blocks);
    expect(result).toBe('title.search:machine learning,publication_year:>2020');
  });

  it('translates title and year to Crossref format', () => {
    const blocks: QueryBlock[] = [
      { id: '1', field: 'title', type: 'contains', value: 'machine learning' },
      { id: '2', field: 'year', type: 'greater_than', value: '2020' }
    ];
    const result = translator.toCrossref(blocks);
    expect(result['query.title']).toBe('machine learning');
    expect(result['filter']).toBe('from-pub-date:2021');
  });
});
