import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiIntegrator } from '../ApiIntegrator';

describe('ApiIntegrator', () => {
  let api: ApiIntegrator;

  beforeEach(() => {
    api = new ApiIntegrator();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchOpenAlex', () => {
    it('calls the OpenAlex API and normalizes the results correctly', async () => {
      const mockResult = {
        results: [
          {
            id: 'https://openalex.org/W123',
            doi: 'https://doi.org/10.1000/xyz123',
            title: 'OpenAlex Title',
            publication_year: 2025,
            authorships: [
              {
                author: { display_name: 'John Doe' },
                institutions: [{ display_name: 'University of Test' }],
              },
            ],
            abstract_inverted_index: {
              This: [0],
              is: [1],
              a: [2],
              test: [3],
            },
            keywords: [{ display_name: 'KeywordA' }],
            concepts: [{ display_name: 'ConceptA' }],
            primary_location: {
              source: { display_name: 'Test Journal', issn_l: '1234-5678' },
            },
            biblio: {
              volume: '10',
              issue: '2',
              first_page: '15',
              last_page: '20',
            },
            referenced_works: ['ref1', 'ref2'],
            type: 'journal-article',
            cited_by_count: 5,
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as any);

      const articles = await api.searchOpenAlex('filter=title.search:test', 'citations', 10);

      expect(fetch).toHaveBeenCalledTimes(1);
      const urlCall = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(urlCall).toContain('api.openalex.org/works');
      expect(urlCall).toContain('filter=title.search%3Atest');
      expect(urlCall).toContain('sort=cited_by_count%3Adesc');
      expect(urlCall).toContain('per_page=10');

      expect(articles).toHaveLength(1);
      const article = articles[0];
      expect(article.doi).toBe('10.1000/xyz123');
      expect(article.title).toBe('OpenAlex Title');
      expect(article.authors).toBe('John Doe');
      expect(article.year).toBe(2025);
      expect(article.abstract).toBe('This is a test');
      expect(article.authorKeywords).toBe('KeywordA');
      expect(article.indexKeywords).toBe('ConceptA');
      expect(article.journal).toBe('Test Journal');
      expect(article.volume).toBe('10');
      expect(article.issue).toBe('2');
      expect(article.pages).toBe('15-20');
      expect(article.affiliations).toBe('University of Test');
      expect(article.references).toBe('ref1; ref2');
      expect(article.documentType).toBe('journal-article');
      expect(article.issn).toBe('1234-5678');
      expect(article.citationCount).toBe(5);
      expect(article.source_databases).toEqual(['OpenAlex']);
    });

    it('throws an error if OpenAlex API request fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' }),
      } as any);

      await expect(api.searchOpenAlex('test', 'relevance', 50)).rejects.toThrow('Internal Server Error');
    });
  });

  describe('searchCrossref', () => {
    it('calls Crossref API and normalizes the results correctly', async () => {
      const mockResult = {
        message: {
          items: [
            {
              DOI: '10.1000/crossref123',
              title: ['Crossref Title'],
              issued: { 'date-parts': [[2024]] },
              author: [
                {
                  given: 'Alice',
                  family: 'Smith',
                  affiliation: [{ name: 'Test Lab' }],
                },
              ],
              abstract: '<p>A beautiful abstract</p>',
              subject: ['SubjectA', 'SubjectB'],
              'container-title': ['Crossref Journal'],
              volume: '15',
              issue: '3',
              page: '100-110',
              reference: [{ DOI: '10.1000/ref' }],
              type: 'journal-article',
              ISSN: ['9876-5432'],
              'is-referenced-by-count': 12,
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as any);

      const articles = await api.searchCrossref('query=test', 'date', 20);

      expect(fetch).toHaveBeenCalledTimes(1);
      const urlCall = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(urlCall).toContain('api.crossref.org/works');
      expect(urlCall).toContain('sort=published');
      expect(urlCall).toContain('order=desc');
      expect(urlCall).toContain('rows=20');

      expect(articles).toHaveLength(1);
      const article = articles[0];
      expect(article.doi).toBe('10.1000/crossref123');
      expect(article.title).toBe('Crossref Title');
      expect(article.authors).toBe('Alice Smith');
      expect(article.year).toBe(2024);
      expect(article.abstract).toBe('A beautiful abstract');
      expect(article.authorKeywords).toBe('SubjectA; SubjectB');
      expect(article.journal).toBe('Crossref Journal');
      expect(article.volume).toBe('15');
      expect(article.issue).toBe('3');
      expect(article.pages).toBe('100-110');
      expect(article.affiliations).toBe('Test Lab');
      expect(article.references).toBe('10.1000/ref');
      expect(article.documentType).toBe('journal-article');
      expect(article.issn).toBe('9876-5432');
      expect(article.citationCount).toBe(12);
      expect(article.source_databases).toEqual(['Crossref']);
    });

    it('throws an error if Crossref request fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad Request' }),
      } as any);

      await expect(api.searchCrossref('query=test', 'relevance', 50)).rejects.toThrow('Bad Request');
    });

    it('handles empty subject and reference arrays, and default limit', async () => {
      const mockResult = {
        message: {
          items: [
            {
              DOI: '10.1000/crossref456',
              title: ['Empty Arrays Title'],
              subject: [],
              reference: [{ unstructured: 'Some unstructured ref' }, {}],
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as any);

      // Call without explicit limit, should default to 50
      const articles = await api.searchCrossref('query=test', 'relevance');

      expect(fetch).toHaveBeenCalledTimes(1);
      const urlCall = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(urlCall).toContain('rows=50');

      expect(articles).toHaveLength(1);
      const article = articles[0];
      expect(article.authorKeywords).toBeUndefined();
      expect(article.references).toBe('Some unstructured ref');
    });
  });

  describe('searchScopus', () => {
    it('returns empty array if no apiKey is provided', async () => {
      const result = await api.searchScopus('query', '', 'relevance', 10);
      expect(result).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('calls Scopus API and normalizes results correctly', async () => {
      const mockResult = {
        'search-results': {
          entry: [
            {
              'prism:doi': '10.1000/scopus123',
              'dc:title': 'Scopus Title',
              'dc:creator': 'Creator, A.',
              'prism:coverDate': '2023-05-12',
              'dc:description': 'Scopus Abstract',
              authkeywords: 'Key1; Key2',
              'prism:publicationName': 'Scopus Journal',
              'prism:volume': '22',
              'prism:issueIdentifier': '4',
              'prism:pageRange': '200-205',
              subtypeDescription: 'Article',
              'citedby-count': '25',
              'prism:issn': '2468-1357',
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as any);

      const articles = await api.searchScopus('TITLE("test")', 'scopus_key', 'citations', 50);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [urlCall, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(urlCall).toContain('api.elsevier.com/content/search/scopus');
      expect(urlCall).toContain('sort=citedby-count');
      expect(urlCall).toContain('count=50');
      expect(init.headers).toEqual({
        'X-ELS-APIKey': 'scopus_key',
        Accept: 'application/json',
      });

      expect(articles).toHaveLength(1);
      const article = articles[0];
      expect(article.doi).toBe('10.1000/scopus123');
      expect(article.title).toBe('Scopus Title');
      expect(article.authors).toBe('Creator, A.');
      expect(article.year).toBe(2023);
      expect(article.abstract).toBe('Scopus Abstract');
      expect(article.authorKeywords).toBe('Key1; Key2');
      expect(article.journal).toBe('Scopus Journal');
      expect(article.volume).toBe('22');
      expect(article.issue).toBe('4');
      expect(article.pages).toBe('200-205');
      expect(article.documentType).toBe('Article');
      expect(article.citationCount).toBe(25);
      expect(article.issn).toBe('2468-1357');
      expect(article.source_databases).toEqual(['Scopus']);
    });

    it('throws key invalid error on 401 response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as any);

      await expect(api.searchScopus('query', 'bad_key', 'relevance', 50)).rejects.toThrow(
        'Chave de API inválida ou expirada',
      );
    });
  });

  describe('searchWoS', () => {
    it('returns empty array if no apiKey is provided', async () => {
      const result = await api.searchWoS('query', '', 'relevance', 10);
      expect(result).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('calls Web of Science API and normalizes results correctly', async () => {
      const mockResult = {
        hits: [
          {
            uid: 'WOS:000123',
            identifiers: { doi: '10.1000/wos123' },
            title: 'WoS Title',
            names: {
              authors: [{ displayName: 'Smith, J.' }, { displayName: 'Jones, M.' }],
            },
            publication: { year: 2022 },
            abstract: 'WoS Abstract',
            keywords: {
              authorKeywords: ['WosKey1', 'WosKey2'],
            },
            source: {
              sourceTitle: 'WoS Journal',
              volume: '5',
              issue: '1',
              pages: { range: '50-60' },
              documentType: 'Article',
            },
            citations: { length: 3 },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as any);

      const articles = await api.searchWoS('TS=test', 'wos_key', 'date', 15);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [urlCall, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(urlCall).toContain('api.clarivate.com/apis/wos-starter/v1/documents');
      expect(urlCall).toContain('db=WOS');
      expect(urlCall).toContain('sortField=PY%2BD');
      expect(urlCall).toContain('limit=15');
      expect(init.headers).toEqual({
        'X-ApiKey': 'wos_key',
        Accept: 'application/json',
      });

      expect(articles).toHaveLength(1);
      const article = articles[0];
      expect(article.doi).toBe('10.1000/wos123');
      expect(article.title).toBe('WoS Title');
      expect(article.authors).toBe('Smith, J., Jones, M.');
      expect(article.year).toBe(2022);
      expect(article.abstract).toBe('WoS Abstract');
      expect(article.authorKeywords).toBe('WosKey1; WosKey2');
      expect(article.journal).toBe('WoS Journal');
      expect(article.volume).toBe('5');
      expect(article.issue).toBe('1');
      expect(article.pages).toBe('50-60');
      expect(article.documentType).toBe('Article');
      expect(article.citationCount).toBe(3);
      expect(article.source_databases).toEqual(['Web of Science']);
    });

    it('correctly maps all sort options to WoS sortField format', async () => {
      const mockResult = { hits: [] };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as any);

      // Relevance sort
      await api.searchWoS('TS=test', 'wos_key', 'relevance');
      let urlCall = vi.mocked(fetch).mock.calls[vi.mocked(fetch).mock.calls.length - 1][0] as string;
      expect(urlCall).toContain('sortField=RS%2BD');

      // Citations sort
      await api.searchWoS('TS=test', 'wos_key', 'citations');
      urlCall = vi.mocked(fetch).mock.calls[vi.mocked(fetch).mock.calls.length - 1][0] as string;
      expect(urlCall).toContain('sortField=TC%2BD');

      // Date sort
      await api.searchWoS('TS=test', 'wos_key', 'date');
      urlCall = vi.mocked(fetch).mock.calls[vi.mocked(fetch).mock.calls.length - 1][0] as string;
      expect(urlCall).toContain('sortField=PY%2BD');
    });

    it('throws key invalid error on 401 response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as any);

      await expect(api.searchWoS('query', 'bad_key', 'relevance', 50)).rejects.toThrow(
        'Chave de API inválida ou expirada',
      );
    });

    it('handles empty keywords and default limit', async () => {
      const mockResult = {
        hits: [
          {
            uid: 'WOS:000456',
            title: 'WoS Empty Keywords Title',
            keywords: {
              authorKeywords: [],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as any);

      // Call without explicit limit, should default to 50
      const articles = await api.searchWoS('TS=test', 'wos_key', 'relevance');

      expect(fetch).toHaveBeenCalledTimes(1);
      const urlCall = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(urlCall).toContain('limit=50');

      expect(articles).toHaveLength(1);
      const article = articles[0];
      expect(article.authorKeywords).toBeUndefined();
    });

    it('handles nested WoS JSON error structures gracefully', async () => {
      // Test case 1: error object with message
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              message: 'Ocorreu um erro na consulta do WoS',
            },
          }),
      } as any);

      await expect(api.searchWoS('invalid_query', 'wos_key', 'relevance')).rejects.toThrow(
        'Ocorreu um erro na consulta do WoS',
      );

      // Test case 2: raw message is object without message property
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              code: 'INVALID_QUERY',
              reason: 'Unknown field',
            },
          }),
      } as any);

      await expect(api.searchWoS('invalid_query', 'wos_key', 'relevance')).rejects.toThrow(
        '{"code":"INVALID_QUERY","reason":"Unknown field"}',
      );

      // Test case 3: error details present
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            message: 'Bad Request',
            details: {
              invalidFields: ['q'],
            },
          }),
      } as any);

      await expect(api.searchWoS('invalid_query', 'wos_key', 'relevance')).rejects.toThrow(
        'Bad Request: {"invalidFields":["q"]}',
      );
    });
  });

  describe('ApiIntegrator fallback branches and edge cases', () => {
    it('returns empty array when api keys are missing for Scopus or WoS', async () => {
      expect(await api.searchScopus('query', '', 'relevance')).toEqual([]);
      expect(await api.searchWoS('query', '', 'relevance')).toEqual([]);
    });

    it('covers searchOpenAlex sort and filter branches', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      } as any);

      // No clean filter and date sort
      await api.searchOpenAlex('', 'date');
      let urlCall = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(urlCall).not.toContain('filter');
      expect(urlCall).toContain('sort=publication_date%3Adesc');

      // relevance sort
      await api.searchOpenAlex('', 'relevance');
      urlCall = vi.mocked(fetch).mock.calls[1][0] as string;
      expect(urlCall).toContain('sort=relevance_score%3Adesc');
    });

    it('covers searchScopus date and relevance sort branches', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ 'search-results': { entry: [] } }),
      } as any);

      await api.searchScopus('q', 'key', 'date');
      let urlCall = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(urlCall).toContain('sort=pubyear');

      await api.searchScopus('q', 'key', 'relevance');
      urlCall = vi.mocked(fetch).mock.calls[1][0] as string;
      expect(urlCall).toContain('sort=relevancy');
    });

    it('covers searchWoS date and relevance sort branches', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ hits: [] }),
      } as any);

      await api.searchWoS('q', 'key', 'date');
      let urlCall = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(urlCall).toContain('sortField=PY%2BD');

      await api.searchWoS('q', 'key', 'relevance');
      urlCall = vi.mocked(fetch).mock.calls[1][0] as string;
      expect(urlCall).toContain('sortField=RS%2BD');
    });

    it('covers non-JSON error response in searchWoS', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway',
      } as any);

      await expect(api.searchWoS('q', 'key', 'relevance')).rejects.toThrow('Erro 502 no Web of Science - Bad Gateway');
    });

    it('covers searchOpenAlex non-JSON error handling', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Not JSON');
        },
      } as any);

      await expect(api.searchOpenAlex('q', 'relevance')).rejects.toThrow('Erro 500 no OpenAlex');
    });

    it('normalizes articles with missing or strange values correctly', () => {
      // 1. normalizeOpenAlex
      const rawOpenAlex = {
        doi: '10.1000/xyz',
        authorships: [{ author: { display_name: 'SingleName' } }, { author: null }],
        keywords: ['DirectKeywordString'],
      };
      const normalizedAlex = (api as any).normalizeOpenAlex(rawOpenAlex);
      expect(normalizedAlex.doi).toBe('10.1000/xyz');
      expect(normalizedAlex.authors).toBe('SingleName');
      expect(normalizedAlex.authorKeywords).toBe('DirectKeywordString');

      // 2. normalizeCrossref
      const rawCrossref = {
        issued: {}, // missing date-parts
        author: [
          { given: 'John', family: 'Doe' },
          { given: 'Alice' }, // missing family
        ],
        abstract: 'Abstract with no HTML tags',
      };
      const normalizedCrossref = (api as any).normalizeCrossref(rawCrossref);
      expect(normalizedCrossref.year).toBeUndefined();
      expect(normalizedCrossref.authors).toBe('John Doe, Alice');
      expect(normalizedCrossref.abstract).toBe('Abstract with no HTML tags');

      // 3. normalizeScopus creator fallback
      const rawScopus = {
        'dc:creator': 'Creator Name',
        'prism:coverDate': '2026-06-03',
      };
      const normalizedScopus = (api as any).normalizeScopus(rawScopus);
      expect(normalizedScopus.authors).toBe('Creator Name');
      expect(normalizedScopus.year).toBe(2026);
    });
  });
});
