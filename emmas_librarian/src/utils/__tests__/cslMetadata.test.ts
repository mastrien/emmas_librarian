import { describe, it, expect, vi } from 'vitest';
import {
  citationFieldsFromArticle,
  citationFieldsFromCsl,
  citationFieldsToMetadata,
  toCitableArticle,
  pickCitationFields,
  tryCitationFieldsFromCsl,
  type CitationFields,
} from '../cslMetadata';
import type { Article } from '../../types';

const empty: CitationFields = {
  title: '',
  authors: '',
  year: '',
  doi: '',
  journal: '',
  volume: '',
  issue: '',
  pages: '',
  url: '',
  accessed: '',
};

describe('citationFieldsFromArticle', () => {
  it('turns missing values into empty strings', () => {
    expect(citationFieldsFromArticle({ id: 1, title: '', status: 'new' } as Article)).toEqual(empty);
  });

  it('stringifies the year and ignores non-citation fields', () => {
    const article = { id: 1, title: 'T', year: 2020, pages: '1-2', abstract: 'x', status: 'read' } as Article;

    expect(citationFieldsFromArticle(article)).toEqual({ ...empty, title: 'T', year: '2020', pages: '1-2' });
  });
});

describe('citationFieldsFromCsl', () => {
  const csl = {
    title: 'CSL title',
    author: [{ given: 'Ana', family: 'Lima' }, { literal: 'Consórcio X' }, { family: 'Só' }, {}],
    issued: { 'date-parts': [[2019, 5]] },
    DOI: '10.1/x',
    'container-title': 'Revista',
    volume: 4,
    issue: '2',
    page: '9-12',
    URL: 'http://x',
  };
  const expected = {
    title: 'CSL title',
    authors: 'Ana Lima; Consórcio X; Só',
    year: '2019',
    doi: '10.1/x',
    journal: 'Revista',
    volume: '4',
    issue: '2',
    pages: '9-12',
    url: 'http://x',
    accessed: '',
  };

  it('maps a parsed CSL object', () => {
    expect(citationFieldsFromCsl(csl)).toEqual(expected);
  });

  it('parses a CSL JSON string', () => {
    expect(citationFieldsFromCsl(JSON.stringify(csl))).toEqual(expected);
  });

  it('accepts the non-standard "pages" key when "page" is absent', () => {
    expect(citationFieldsFromCsl({ pages: '5-6' }).pages).toBe('5-6');
  });

  it('returns empty fields for an empty record', () => {
    expect(citationFieldsFromCsl('{}')).toEqual(empty);
  });

  it('throws on malformed JSON', () => {
    expect(() => citationFieldsFromCsl('{bad')).toThrow(SyntaxError);
  });
});

describe('citationFieldsToMetadata', () => {
  it('converts the year to a number', () => {
    expect(citationFieldsToMetadata({ ...empty, title: 'T', year: '2021' })).toEqual({
      ...empty,
      title: 'T',
      year: 2021,
    });
  });

  it('drops a blank year', () => {
    expect(citationFieldsToMetadata(empty).year).toBeUndefined();
  });
});

describe('toCitableArticle', () => {
  it('keeps other article fields and replaces citation fields with strings', () => {
    const article = { id: 3, title: 'T', year: 1999, abstract: 'a', status: 'read' } as Article;

    expect(toCitableArticle(article)).toEqual({
      ...empty,
      id: 3,
      title: 'T',
      year: '1999',
      abstract: 'a',
      status: 'read',
    });
  });
});

describe('pickCitationFields', () => {
  it('drops everything except the citation fields', () => {
    const citable = toCitableArticle({ id: 3, title: 'T', abstract: 'a', status: 'read' } as Article);

    expect(pickCitationFields(citable)).toEqual({ ...empty, title: 'T' });
  });
});

describe('tryCitationFieldsFromCsl', () => {
  it.each([null, undefined, ''])('returns null without CSL-JSON (%s)', (cslJson) => {
    expect(tryCitationFieldsFromCsl(cslJson)).toBeNull();
  });

  it('returns the parsed fields', () => {
    expect(tryCitationFieldsFromCsl('{"title":"X"}')).toEqual({ ...empty, title: 'X' });
  });

  it('logs and returns null for malformed JSON', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(tryCitationFieldsFromCsl('{bad')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith('Failed to parse csl_json for reset', expect.any(SyntaxError));
    consoleError.mockRestore();
  });
});
