import { describe, expect, it } from 'vitest';
import { splitAuthorNames } from '../authors';

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
