import { describe, it, expect } from 'vitest';
import { normalizeIeee, type IeeeArticle } from '../ieee';

// An article shaped like the IEEE Xplore Metadata API documents it (fields the app reads).
const article: IeeeArticle = {
  article_number: '9123456',
  doi: '10.1109/TSG.2024.1234567',
  title: 'Machine Learning for Smart Grid Stability',
  authors: {
    authors: [
      { full_name: 'Ana Lima', affiliation: 'Universidade Federal de Minas Gerais' },
      { full_name: 'Bruno Souza', affiliation: 'Universidade Federal de Minas Gerais' },
    ],
  },
  abstract: 'We study stability.',
  publication_year: 2024,
  publication_title: 'IEEE Transactions on Smart Grid',
  volume: '15',
  issue: '2',
  start_page: '1200',
  end_page: '1210',
  issn: '1949-3053',
  publisher: 'IEEE',
  content_type: 'Journals',
  access_type: 'OPEN_ACCESS',
  citing_paper_count: 12,
  index_terms: {
    author_terms: { terms: ['smart grid', 'stability'] },
    ieee_terms: { terms: ['Power system stability'] },
  },
  html_url: 'https://ieeexplore.ieee.org/document/9123456/',
};

describe('normalizeIeee', () => {
  it('maps an IEEE Xplore article to the article shape', () => {
    expect(normalizeIeee(article)).toMatchObject({
      doi: '10.1109/TSG.2024.1234567',
      title: 'Machine Learning for Smart Grid Stability',
      authors: 'Ana Lima, Bruno Souza',
      year: 2024,
      abstract: 'We study stability.',
      authorKeywords: 'smart grid; stability',
      indexKeywords: 'Power system stability',
      journal: 'IEEE Transactions on Smart Grid',
      pages: '1200-1210',
      affiliations: 'Universidade Federal de Minas Gerais',
      documentType: 'Journals',
      citationCount: 12,
      source_databases: ['IEEE Xplore'],
      is_oa: 1,
      publisher: 'IEEE',
    });
  });

  it('marks locked articles as closed and leaves open access unknown when IEEE does not say', () => {
    expect(normalizeIeee({ title: 'T', access_type: 'LOCKED' }).is_oa).toBe(0);
    expect(normalizeIeee({ title: 'T' }).is_oa).toBeUndefined();
  });
});
