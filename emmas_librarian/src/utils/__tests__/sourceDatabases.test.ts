import { describe, it, expect } from 'vitest';
import { parseSourceDatabases } from '../sourceDatabases';

describe('parseSourceDatabases', () => {
  it.each([
    ['a JSON array', '["Scopus","OpenAlex"]', ['Scopus', 'OpenAlex']],
    ['an empty JSON array', '[]', []],
    ['a single JSON string', '"Scopus"', ['Scopus']],
    ['a bare legacy name', 'Manual', ['Manual']],
    ['an already parsed array', ['PubMed'], ['PubMed']],
    ['an empty string', '', []],
    ['null', null, []],
    ['undefined', undefined, []],
  ])('reads %s', (_label, raw, expected) => {
    expect(parseSourceDatabases(raw)).toEqual(expected);
  });
});
