import { describe, it, expect } from 'vitest';
import { arxivId, normalizeArxiv } from '../arxiv';
import type { ArxivEntry } from '../atomFeed';

const entry = (overrides: Partial<ArxivEntry> = {}): ArxivEntry => ({
  id: 'http://arxiv.org/abs/2609.32552v1',
  title: 'Uncovering flame physics with machine learning',
  summary: 'Convolutional Neural Networks are used as analytical tools.',
  published: '2026-09-26T12:30:25Z',
  authors: [{ name: 'Antonio Attili' }, { name: 'Ludovico Nista', affiliation: 'RWTH Aachen' }],
  pdfUrl: 'https://arxiv.org/pdf/2609.32552v1',
  primaryCategory: 'physics.flu-dyn',
  ...overrides,
});

describe('arxivId', () => {
  it('drops the URL and the version of new and old identifiers', () => {
    expect(arxivId('http://arxiv.org/abs/2609.32552v3')).toBe('2609.32552');
    expect(arxivId('https://arxiv.org/abs/hep-th/9901001v1')).toBe('hep-th/9901001');
  });
});

describe('normalizeArxiv', () => {
  it("maps a preprint with arXiv's own DOI, so it deduplicates with OpenAlex", () => {
    expect(normalizeArxiv(entry())).toMatchObject({
      doi: '10.48550/arXiv.2609.32552',
      title: 'Uncovering flame physics with machine learning',
      authors: 'Antonio Attili, Ludovico Nista',
      year: 2026,
      abstract: 'Convolutional Neural Networks are used as analytical tools.',
      authorKeywords: 'physics.flu-dyn',
      journal: 'arXiv',
      affiliations: 'RWTH Aachen',
      documentType: 'preprint',
      source_databases: ['arXiv'],
      is_oa: 1,
      publisher: 'arXiv',
    });
  });

  it('uses the journal DOI and reference once the preprint was published', () => {
    const article = normalizeArxiv(entry({ doi: '10.1103/PhysRevD.1.1', journalRef: 'Phys. Rev. D 1 (1999) 1' }));

    expect(article).toMatchObject({
      doi: '10.1103/PhysRevD.1.1',
      journal: 'Phys. Rev. D 1 (1999) 1',
      documentType: 'article',
    });
  });
});
