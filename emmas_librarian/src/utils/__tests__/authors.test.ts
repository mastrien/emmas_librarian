import { describe, expect, it } from 'vitest';
import { shortAuthorList, splitAuthorNames } from '../authors';

describe('splitAuthorNames', () => {
  it.each([
    ['semicolon-separated, family-first', 'Silva, A.; Costa, B.; Mendes, R.', ['Silva, A.', 'Costa, B.', 'Mendes, R.']],
    [
      'comma-separated full names (OpenAlex)',
      'Ana Silva, Bruno Costa, Carla Mendes',
      ['Ana Silva', 'Bruno Costa', 'Carla Mendes'],
    ],
    ['two full names with one comma', 'Ana Silva, Bruno Costa', ['Ana Silva', 'Bruno Costa']],
    ['one family-first name', 'Doe, John', ['Doe, John']],
    ['one name', 'Instituto Estadual de Meteorologia', ['Instituto Estadual de Meteorologia']],
    ['empty entries and spaces', ' Silva, A.; ; Costa, B. ;', ['Silva, A.', 'Costa, B.']],
    ['an empty value', '', []],
    ['null', null, []],
  ])('splits %s', (_label, raw, expected) => {
    expect(splitAuthorNames(raw)).toEqual(expected);
  });
});

describe('shortAuthorList', () => {
  it('keeps the first three authors and counts the rest', () => {
    expect(shortAuthorList('Silva, A.; Costa, B.; Lima, C.; Rocha, D.')).toBe('Silva, A.; Costa, B.; Lima, C.; +1');
    expect(shortAuthorList('Silva, A.; Costa, B.')).toBe('Silva, A.; Costa, B.');
  });

  it('says when there are no authors', () => {
    expect(shortAuthorList(null)).toBe('Autores desconhecidos');
  });
});
