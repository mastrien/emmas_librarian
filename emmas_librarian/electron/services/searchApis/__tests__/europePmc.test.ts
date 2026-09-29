import { describe, it, expect } from 'vitest';
import { normalizeEuropePmc, type EuropePmcResult } from '../europePmc';

// A MEDLINE record as Europe PMC returns it with resultType=core (fields trimmed to what the app reads).
const record: EuropePmcResult = {
  id: '38012345',
  source: 'MED',
  pmid: '38012345',
  pmcid: 'PMC1234567',
  doi: '10.1002/14651858.CD012345.pub2',
  title: 'Exercise for type 2 diabetes mellitus.',
  pubYear: '2024',
  abstractText: '<h4>Background</h4><p>Exercise <b>improves</b> glycaemic control.</p>',
  authorList: {
    author: [
      {
        fullName: 'Silva AB',
        firstName: 'Ana Beatriz',
        lastName: 'Silva',
        authorAffiliationDetailsList: { authorAffiliation: [{ affiliation: 'Universidade de São Paulo' }] },
      },
      { fullName: 'Souza C' },
    ],
  },
  journalInfo: {
    volume: '5',
    issue: '3',
    journal: { title: 'The Cochrane database of systematic reviews', issn: '1361-6137' },
  },
  pageInfo: 'CD012345',
  isOpenAccess: 'Y',
  citedByCount: 42,
  keywordList: { keyword: ['Exercise', 'Diabetes'] },
  meshHeadingList: { meshHeading: [{ descriptorName: 'Diabetes Mellitus, Type 2' }, { descriptorName: 'Exercise' }] },
  pubTypeList: { pubType: ['Systematic Review', 'Journal Article'] },
};

describe('normalizeEuropePmc', () => {
  it('maps a MEDLINE record, including a Cochrane review, to the article shape', () => {
    const article = normalizeEuropePmc(record);

    expect(article).toMatchObject({
      doi: '10.1002/14651858.CD012345.pub2',
      title: 'Exercise for type 2 diabetes mellitus',
      authors: 'Ana Beatriz Silva, Souza C',
      year: 2024,
      abstract: 'Background Exercise improves glycaemic control.',
      authorKeywords: 'Exercise; Diabetes',
      indexKeywords: 'Diabetes Mellitus, Type 2; Exercise',
      journal: 'The Cochrane database of systematic reviews',
      volume: '5',
      issue: '3',
      pages: 'CD012345',
      affiliations: 'Universidade de São Paulo',
      documentType: 'Systematic Review',
      issn: '1361-6137',
      citationCount: 42,
      source_databases: ['Europe PMC'],
      is_oa: 1,
    });
    expect(article.csl_json).toMatchObject({ PMID: '38012345', PMCID: 'PMC1234567' });
  });

  it('leaves unknown values empty instead of guessing', () => {
    const article = normalizeEuropePmc({ title: 'Preprint without metadata' });

    expect(article).toMatchObject({ doi: '', title: 'Preprint without metadata', authors: '', is_oa: undefined });
    expect(article.year).toBeUndefined();
    expect(article.abstract).toBeUndefined();
  });

  // Seen in a real response: trials often list only the research group as author.
  it('keeps a group author', () => {
    const article = normalizeEuropePmc({
      title: 'T',
      authorList: { author: [{ collectiveName: 'Diabetes Control and Complications Trial Research Group' }] },
    });

    expect(article.authors).toBe('Diabetes Control and Complications Trial Research Group');
  });

  it('marks a closed record as not open access', () => {
    expect(normalizeEuropePmc({ title: 'T', isOpenAccess: 'N' }).is_oa).toBe(0);
  });
});
