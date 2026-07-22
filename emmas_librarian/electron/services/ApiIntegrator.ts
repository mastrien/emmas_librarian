/* eslint-disable @typescript-eslint/no-explicit-any */
import { NormalizedArticle } from './types';

export class ApiIntegrator {
  private OPENALEX_URL = 'https://api.openalex.org/works';
  private CROSSREF_URL = 'https://api.crossref.org/works';
  private SCOPUS_URL = 'https://api.elsevier.com/content/search/scopus';
  private WOS_URL = 'https://api.clarivate.com/apis/wos-starter/v1/documents';

  async searchOpenAlex(
    filterStr: string,
    sortBy: 'relevance' | 'citations' | 'date',
    limit: number = 50,
  ): Promise<NormalizedArticle[]> {
    try {
      const url = new URL(this.OPENALEX_URL);

      // If filterStr contains 'filter=', extract just the value
      let cleanFilter = filterStr;
      if (filterStr.includes('filter=')) {
        const parts = filterStr.split('filter=');
        cleanFilter = parts[parts.length - 1];
      }

      if (cleanFilter) url.searchParams.append('filter', cleanFilter);
      url.searchParams.append('per_page', String(Math.min(limit, 200))); // OpenAlex max is 200

      if (sortBy === 'citations') url.searchParams.append('sort', 'cited_by_count:desc');
      else if (sortBy === 'date') url.searchParams.append('sort', 'publication_date:desc');
      else url.searchParams.append('sort', 'relevance_score:desc');

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        return results.map((item: unknown) => this.normalizeOpenAlex(item));
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro ${response.status} no OpenAlex`);
    } catch (e: any) {
      console.error('OpenAlex fetch error', e);
      throw e;
    }
  }

  async searchCrossref(
    queryStr: string,
    sortBy: 'relevance' | 'citations' | 'date',
    limit: number = 50,
  ): Promise<NormalizedArticle[]> {
    try {
      // Use URLSearchParams to parse queryStr and add sorting
      const url = new URL(this.CROSSREF_URL);
      const searchParams = new URLSearchParams(queryStr);
      searchParams.set('rows', String(Math.min(limit, 1000))); // Crossref max is 1000

      if (sortBy === 'citations') {
        searchParams.set('sort', 'is-referenced-by-count');
        searchParams.set('order', 'desc');
      } else if (sortBy === 'date') {
        searchParams.set('sort', 'published');
        searchParams.set('order', 'desc');
      } else if (!searchParams.has('sort')) {
        searchParams.set('sort', 'score');
      }

      url.search = searchParams.toString();

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        const items = data.message?.items || [];
        return items.map((item: unknown) => this.normalizeCrossref(item));
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro ${response.status} no Crossref`);
    } catch (e: any) {
      console.error('Crossref fetch error', e);
      throw e;
    }
  }

  async searchScopus(
    queryStr: string,
    apiKey: string,
    sortBy: 'relevance' | 'citations' | 'date',
    limit: number = 50,
  ): Promise<NormalizedArticle[]> {
    if (!apiKey) return [];
    try {
      const url = new URL(this.SCOPUS_URL);
      url.searchParams.append('query', queryStr);
      url.searchParams.append('count', String(Math.min(limit, 200))); // Scopus max per request is 200

      if (sortBy === 'citations') url.searchParams.append('sort', 'citedby-count');
      else if (sortBy === 'date') url.searchParams.append('sort', 'pubyear');
      else url.searchParams.append('sort', 'relevancy');

      const response = await fetch(url.toString(), {
        headers: { 'X-ELS-APIKey': apiKey, Accept: 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const entries = data['search-results']?.entry || [];
        return entries.map((item: unknown) => this.normalizeScopus(item));
      }
      if (response.status === 401) throw new Error('Chave de API inválida ou expirada');
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData['service-error']?.status?.statusText || `Erro ${response.status} no Scopus`);
    } catch (e: any) {
      console.error('Scopus fetch error', e);
      throw e;
    }
  }

  async searchWoS(
    queryStr: string,
    apiKey: string,
    sortBy: 'relevance' | 'citations' | 'date',
    limit: number = 50,
  ): Promise<NormalizedArticle[]> {
    if (!apiKey) return [];
    try {
      const url = new URL(this.WOS_URL);
      url.searchParams.append('db', 'WOS');
      url.searchParams.append('q', queryStr);
      url.searchParams.append('limit', String(Math.min(limit, 50)));
      url.searchParams.append('page', '1');

      // Starter API sorting: Field+Direction
      if (sortBy === 'citations') url.searchParams.append('sortField', 'TC+D');
      else if (sortBy === 'date') url.searchParams.append('sortField', 'PY+D');
      else url.searchParams.append('sortField', 'RS+D');

      const response = await fetch(url.toString(), {
        headers: {
          'X-ApiKey': apiKey,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const hits = data.hits || [];
        return hits.map((item: unknown) => this.normalizeWoS(item));
      }
      if (response.status === 401) throw new Error('Chave de API inválida ou expirada');

      const responseText = await response.text().catch(() => '');
      let errorMessage = `Erro ${response.status} no Web of Science`;
      try {
        const errorData = JSON.parse(responseText);
        const rawMessage = errorData.message || errorData.error || errorData.description || errorData.details;
        if (rawMessage) {
          if (typeof rawMessage === 'object') {
            if (rawMessage.message) {
              errorMessage = String(rawMessage.message);
            } else if (rawMessage.error && typeof rawMessage.error === 'object' && rawMessage.error.message) {
              errorMessage = String(rawMessage.error.message);
            } else {
              errorMessage = JSON.stringify(rawMessage);
            }
          } else {
            errorMessage = String(rawMessage);
          }
        }
        if (errorData.details && typeof errorData.details === 'object' && errorData.details !== rawMessage) {
          errorMessage += `: ${JSON.stringify(errorData.details)}`;
        }
      } catch {
        if (responseText) {
          errorMessage = `${errorMessage} - ${responseText}`;
        }
      }
      throw new Error(errorMessage);
    } catch (e: any) {
      console.error('WoS fetch error', e);
      throw e;
    }
  }

  private normalizeOpenAlex(raw: any): NormalizedArticle {
    let doi = raw.doi || '';
    if (doi && doi.includes('doi.org/')) {
      doi = doi.split('doi.org/').pop() || doi;
    }

    const authors = [];
    for (const auth of raw.authorships || []) {
      const name = auth.author?.display_name || '';
      if (name) {
        const parts = name.split(' ');
        if (parts.length > 1) {
          authors.push({ given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] });
        } else {
          authors.push({ family: name });
        }
      }
    }

    const year = raw.publication_year;

    // Reconstruct abstract from inverted index
    let abstract: string | undefined;
    if (raw.abstract_inverted_index) {
      const pairs: [string, number][] = [];
      for (const [word, positions] of Object.entries(raw.abstract_inverted_index)) {
        for (const pos of positions as number[]) {
          pairs.push([word, pos]);
        }
      }
      pairs.sort((a, b) => a[1] - b[1]);
      abstract = pairs.map((p) => p[0]).join(' ');
    }

    // Author keywords
    const authorKeywords = raw.keywords?.length
      ? raw.keywords.map((k: any) => k.display_name || k.keyword || k).join('; ')
      : undefined;

    // Index keywords from concepts
    const indexKeywords = raw.concepts?.length ? raw.concepts.map((c: any) => c.display_name).join('; ') : undefined;

    // Journal / volume / issue / pages
    const journal = raw.primary_location?.source?.display_name;
    const volume = raw.biblio?.volume;
    const issue = raw.biblio?.issue;
    const firstPage = raw.biblio?.first_page;
    const lastPage = raw.biblio?.last_page;
    const pages = firstPage ? (lastPage ? `${firstPage}-${lastPage}` : firstPage) : undefined;

    // Affiliations: unique institution names across all authorships
    const allInstitutions: string[] = [];
    for (const auth of raw.authorships || []) {
      for (const inst of auth.institutions || []) {
        if (inst.display_name && !allInstitutions.includes(inst.display_name)) {
          allInstitutions.push(inst.display_name);
        }
      }
    }
    const affiliations = allInstitutions.length ? allInstitutions.join('; ') : undefined;

    // References (OpenAlex IDs)
    const references = raw.referenced_works?.length ? raw.referenced_works.join('; ') : undefined;

    const documentType = raw.type_crossref || raw.type;
    const issn = raw.primary_location?.source?.issn_l;
    const citationCount = raw.cited_by_count;

    const isOa = raw.open_access?.is_oa ? 1 : 0;
    const publisher =
      raw.primary_location?.source?.host_organization_name || raw.primary_location?.source?.publisher || undefined;

    const cslJson = {
      id: raw.id,
      type: 'article-journal',
      title: raw.title,
      DOI: doi,
      issued: { 'date-parts': [[year]] },
      author: authors,
      is_oa: isOa,
      publisher: publisher,
    };

    return {
      doi,
      title: raw.title || '',
      authors: authors.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).join(', '),
      year: year,
      abstract,
      authorKeywords,
      indexKeywords,
      journal,
      volume,
      issue,
      pages,
      affiliations,
      references,
      documentType,
      issn,
      citationCount,
      source_databases: ['OpenAlex'],
      csl_json: cslJson,
      is_oa: isOa,
      publisher: publisher,
    };
  }

  private normalizeCrossref(raw: any): NormalizedArticle {
    const title = raw.title && raw.title.length > 0 ? raw.title[0] : '';
    const year = raw.issued?.['date-parts']?.[0]?.[0];
    const authors = (raw.author || []).map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).join(', ');

    // Abstract (strip XML/HTML tags if present)
    const abstract = raw.abstract ? raw.abstract.replace(/<[^>]*>/g, '').trim() : undefined;

    // Author keywords (Crossref uses "subject" field)
    const authorKeywords = raw.subject?.length ? raw.subject.join('; ') : undefined;

    const journal = raw['container-title']?.[0];
    const volume = raw.volume;
    const issue = raw.issue;
    const pages = raw.page;

    // Affiliations: unique affiliation names from all authors
    const allAffiliations: string[] = [];
    for (const a of raw.author || []) {
      for (const aff of a.affiliation || []) {
        if (aff.name && !allAffiliations.includes(aff.name)) {
          allAffiliations.push(aff.name);
        }
      }
    }
    const affiliations = allAffiliations.length ? allAffiliations.join('; ') : undefined;

    // References
    const references = raw.reference?.length
      ? raw.reference
          .map((ref: any) => ref.DOI || ref.unstructured || '')
          .filter(Boolean)
          .join('; ')
      : undefined;

    const documentType = raw.type;
    const issn = raw.ISSN?.[0];
    const citationCount = raw['is-referenced-by-count'];

    const publisher = raw.publisher || undefined;

    const cslJson = {
      id: raw.DOI,
      type: 'article-journal',
      title: title,
      DOI: raw.DOI,
      issued: raw.issued,
      author: raw.author || [],
      publisher: publisher,
    };

    return {
      doi: raw.DOI,
      title: title,
      authors: authors,
      year: year,
      abstract,
      authorKeywords,
      journal,
      volume,
      issue,
      pages,
      affiliations,
      references,
      documentType,
      issn,
      citationCount,
      source_databases: ['Crossref'],
      csl_json: cslJson,
      publisher: publisher,
    };
  }

  private normalizeScopus(raw: any): NormalizedArticle {
    const doi = raw['prism:doi'] || '';
    const title = raw['dc:title'] || '';
    const authors = raw['dc:creator'] || '';
    const date = raw['prism:coverDate'] || '';
    const year = date ? parseInt(date.split('-')[0]) : undefined;

    const abstract = raw['dc:description'] || undefined;
    const authorKeywords = raw.authkeywords || undefined;
    const journal = raw['prism:publicationName'] || undefined;
    const volume = raw['prism:volume'] || undefined;
    const issue = raw['prism:issueIdentifier'] || undefined;
    const pages = raw['prism:pageRange'] || undefined;
    const documentType = raw['subtypeDescription'] || raw['prism:aggregationType'] || undefined;
    const citedByRaw = raw['citedby-count'];
    const citationCount = citedByRaw != null ? parseInt(citedByRaw, 10) : undefined;
    const issn = raw['prism:issn'] || undefined;

    const isOa =
      raw.openaccess === '1' || raw.openaccess === 1 || raw.openaccess === 'true' || raw.openaccess === true ? 1 : 0;

    const cslJson = {
      id: doi || raw['dc:identifier'],
      type: 'article-journal',
      title,
      DOI: doi,
      issued: year ? { 'date-parts': [[year]] } : undefined,
      author: [{ family: authors }],
      is_oa: isOa,
      publisher: undefined,
    };

    return {
      doi,
      title,
      authors,
      year,
      abstract,
      authorKeywords,
      journal,
      volume,
      issue,
      pages,
      documentType,
      citationCount,
      issn,
      source_databases: ['Scopus'],
      csl_json: cslJson,
      is_oa: isOa,
      publisher: undefined,
    };
  }

  private normalizeWoS(raw: any): NormalizedArticle {
    const doi = raw.identifiers?.doi || '';
    const title = raw.title || '';
    const authors = (raw.names?.authors || []).map((a: any) => a.displayName).join(', ');
    const year = raw.publication?.year;

    const abstract = raw.other?.abstract || raw.abstract || undefined;
    const authorKeywords = raw.keywords?.authorKeywords?.length ? raw.keywords.authorKeywords.join('; ') : undefined;
    const journal = raw.source?.sourceTitle || undefined;
    const volume = raw.source?.volume || undefined;
    const issue = raw.source?.issue || undefined;
    const pages = raw.source?.pages?.range || undefined;
    const documentType = raw.doctype || raw.source?.documentType || undefined;
    const citationCount = raw.citations?.length ?? raw.citationCount ?? undefined;

    const cslJson = {
      id: doi || raw.uid,
      type: 'article-journal',
      title,
      DOI: doi,
      issued: year ? { 'date-parts': [[year]] } : undefined,
      author: (raw.names?.authors || []).map((a: any) => ({ family: a.displayName })),
      is_oa: undefined,
      publisher: undefined,
    };

    return {
      doi,
      title,
      authors,
      year,
      abstract,
      authorKeywords,
      journal,
      volume,
      issue,
      pages,
      documentType,
      citationCount,
      source_databases: ['Web of Science'],
      csl_json: cslJson,
      is_oa: undefined,
      publisher: undefined,
    };
  }
}
