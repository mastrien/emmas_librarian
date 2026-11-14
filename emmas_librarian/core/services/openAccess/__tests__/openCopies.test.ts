import { describe, it, expect } from 'vitest';
import { arxivIdFromDoi, findOpenCopies, pmcidOf } from '../openCopies';
import { FakeWeb } from './fakes/FakeWeb';

// The Diabetes Care article checked on 2026-09-29: its publisher link answered a bot check, the PMC bucket
// handed over the PDF. Locations trimmed to the fields the app reads.
const DIABETES_CARE = {
  ids: { openalex: 'https://openalex.org/W2520432709' },
  locations: [
    {
      is_oa: true,
      pdf_url: 'https://diabetesjournals.org/care/article-pdf/34/Supplement_1/S62/477852/zdc10111000s62.pdf',
      landing_page_url: 'https://doi.org/10.2337/dc11-s062',
      source: { display_name: 'Diabetes Care', type: 'journal' },
    },
    {
      is_oa: false,
      pdf_url: null,
      landing_page_url: 'https://pubmed.ncbi.nlm.nih.gov/21193628',
      source: { type: 'repository' },
    },
    {
      is_oa: true,
      pdf_url: 'https://discovery.ucl.ac.uk/1/1/paper.pdf',
      landing_page_url: 'https://discovery.ucl.ac.uk/1/',
      source: { display_name: 'UCL Discovery', type: 'repository' },
    },
    {
      is_oa: true,
      pdf_url: null,
      landing_page_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/3006051',
      source: { display_name: 'PubMed Central', type: 'repository' },
    },
  ],
};

describe('arxivIdFromDoi', () => {
  it('reads the identifier of a DOI arXiv assigned, and nothing from other DOIs', () => {
    expect(arxivIdFromDoi('10.48550/arXiv.2609.32552')).toBe('2609.32552');
    expect(arxivIdFromDoi('10.2337/dc11-s062')).toBeNull();
  });
});

describe('pmcidOf', () => {
  it('takes the PMCID from OpenAlex ids or, when missing there, from the PubMed Central copy URL', () => {
    expect(pmcidOf({ ids: { pmcid: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC123' } })).toBe('PMC123');
    expect(pmcidOf(DIABETES_CARE)).toBe('PMC3006051');
    expect(pmcidOf({ locations: [] })).toBeNull();
  });
});

describe('findOpenCopies', () => {
  it('orders copies from the most reliable: the PMC bucket (newest version), repositories, then the publisher', async () => {
    const web = new FakeWeb().onOpenAlexWork('10.2337/dc11-s062', DIABETES_CARE).onPmcVersions('PMC3006051', [1, 2]);

    const { copies, landingPages } = await findOpenCopies('10.2337/dc11-s062', web);

    expect(copies).toEqual([
      {
        url: 'https://pmc-oa-opendata.s3.amazonaws.com/PMC3006051.2/PMC3006051.2.pdf',
        source: 'PubMed Central',
        kind: 'pmc',
      },
      { url: 'https://discovery.ucl.ac.uk/1/1/paper.pdf', source: 'UCL Discovery', kind: 'repository' },
      {
        url: 'https://diabetesjournals.org/care/article-pdf/34/Supplement_1/S62/477852/zdc10111000s62.pdf',
        source: 'Diabetes Care',
        kind: 'publisher',
      },
    ]);
    expect(landingPages).toEqual([
      'https://doi.org/10.2337/dc11-s062',
      'https://discovery.ucl.ac.uk/1/',
      'https://www.ncbi.nlm.nih.gov/pmc/articles/3006051',
    ]);
  });

  it('skips the PMC bucket when the article is not in its open access subset', async () => {
    const web = new FakeWeb().onOpenAlexWork('10.2337/dc11-s062', DIABETES_CARE).onPmcVersions('PMC3006051', []);

    const { copies } = await findOpenCopies('10.2337/dc11-s062', web);

    expect(copies.map((c) => c.kind)).toEqual(['repository', 'publisher']);
  });

  it('tries arXiv first for a preprint, even when OpenAlex does not know it', async () => {
    const { copies } = await findOpenCopies('10.48550/arxiv.2609.32552', new FakeWeb());

    expect(copies).toEqual([{ url: 'https://arxiv.org/pdf/2609.32552', source: 'arXiv', kind: 'arxiv' }]);
  });

  it('turns an arXiv location into the arXiv PDF link', async () => {
    const web = new FakeWeb().onOpenAlexWork('10.1103/physrevd.1.1', {
      locations: [
        {
          is_oa: true,
          pdf_url: null,
          landing_page_url: 'https://arxiv.org/abs/hep-th/9901001v2',
          source: { type: 'repository' },
        },
      ],
    });

    const { copies } = await findOpenCopies('10.1103/physrevd.1.1', web);

    expect(copies).toEqual([{ url: 'https://arxiv.org/pdf/hep-th/9901001', source: 'arXiv', kind: 'arxiv' }]);
  });

  it('sends the OpenAlex key as a bearer token when there is one', async () => {
    const web = new FakeWeb().onOpenAlexWork('10.1/x', { locations: [] });

    await findOpenCopies('10.1/x', web, 'chave');

    expect(web.requested[0].headers).toEqual({ Authorization: 'Bearer chave' });
  });

  it('reports an OpenAlex failure instead of saying there is no open copy', async () => {
    const web = new FakeWeb().on(
      'https://api.openalex.org/works/doi:10.1%2Fx?select=ids,locations,open_access',
      'erro',
      503,
    );

    await expect(findOpenCopies('10.1/x', web)).rejects.toThrow('Erro 503 ao consultar a OpenAlex');
  });
});
