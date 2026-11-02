import { describe, expect, it } from 'vitest';
import { draftOf } from '../PrismaOrigins';

describe('draftOf', () => {
  it('starts the edit form from the source, with its id and empty text for what was never told', () => {
    const source = {
      id: 2,
      project_id: 1,
      name: 'Scholar',
      method: 'websites' as const,
      url: null,
      consulted_on: null,
    };

    expect(draftOf(source)).toEqual({ id: 2, name: 'Scholar', method: 'websites', url: '', consulted_on: '' });
  });

  it('keeps the address and the day consulted when the source has them', () => {
    const source = {
      id: 3,
      project_id: 1,
      name: 'Referências',
      method: 'citations' as const,
      url: 'https://example.org',
      consulted_on: '2026-10-01',
    };

    expect(draftOf(source)).toMatchObject({ url: 'https://example.org', consulted_on: '2026-10-01' });
  });
});
