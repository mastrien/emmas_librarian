import type { HttpClient } from './httpClient';

/** Where a copy is kept, from the most to the least likely to hand the PDF to a program. */
export type OpenCopyKind = 'arxiv' | 'pmc' | 'repository' | 'publisher';

export interface OpenCopy {
  url: string;
  /** Shown to the user: "arXiv", "PubMed Central", "UCL Discovery", the journal name. */
  source: string;
  kind: OpenCopyKind;
}

export interface OpenCopies {
  copies: OpenCopy[];
  /** Pages of the open copies, to open in the browser when no copy hands over the PDF. */
  landingPages: string[];
}

interface OpenAlexLocation {
  is_oa?: boolean;
  pdf_url?: string | null;
  landing_page_url?: string | null;
  source?: { display_name?: string; type?: string } | null;
}

interface OpenAlexWork {
  ids?: { pmcid?: string };
  locations?: OpenAlexLocation[];
}

const KIND_ORDER: OpenCopyKind[] = ['arxiv', 'pmc', 'repository', 'publisher'];
const PMC_BUCKET = 'https://pmc-oa-opendata.s3.amazonaws.com';

/**
 * The arXiv identifier of a DOI arXiv assigned (10.48550/arXiv.<id>), or null.
 *
 * Usage:
 *   arxivIdFromDoi('10.48550/arXiv.2609.32552'); // '2609.32552'
 */
export function arxivIdFromDoi(doi: string): string | null {
  return /^10\.48550\/arxiv\.(.+)$/i.exec(doi.trim())?.[1] ?? null;
}

const arxivIdFromUrl = (url: string) =>
  /arxiv\.org\/(?:abs|pdf)\/([^?#]+?)(?:v\d+)?(?:\.pdf)?$/i.exec(url)?.[1] ?? null;

/**
 * The PMCID ("PMC3006051") from OpenAlex ids or the URL of a PubMed Central copy; null when there is none.
 *
 * Usage:
 *   pmcidOf({ locations: [{ landing_page_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/3006051' }] }); // 'PMC3006051'
 */
export function pmcidOf(work: OpenAlexWork): string | null {
  const candidates = [work.ids?.pmcid, ...(work.locations ?? []).map((l) => l.landing_page_url)];
  for (const value of candidates) {
    const match = /pmc\/articles\/(?:PMC)?(\d+)/i.exec(value ?? '') ?? /^(?:PMC)?(\d+)$/i.exec(value ?? '');
    if (match) return `PMC${match[1]}`;
  }
  return null;
}

// The PMC Cloud Service keeps each article as PMC<id>.<version>/; the newest version holds the current PDF.
async function pmcBucketCopy(pmcid: string, http: HttpClient): Promise<OpenCopy | null> {
  const listing = await http.get(`${PMC_BUCKET}/?list-type=2&prefix=${pmcid}.&delimiter=/`);
  if (!listing.ok) return null;
  const versions = [...(await listing.text()).matchAll(new RegExp(`<Prefix>${pmcid}\\.(\\d+)/</Prefix>`, 'g'))].map(
    (m) => Number(m[1]),
  );
  if (versions.length === 0) return null;
  const folder = `${pmcid}.${Math.max(...versions)}`;
  return { url: `${PMC_BUCKET}/${folder}/${folder}.pdf`, source: 'PubMed Central', kind: 'pmc' };
}

function locationCopy(location: OpenAlexLocation): OpenCopy | null {
  const url = location.pdf_url ?? '';
  const arxivId = arxivIdFromUrl(url) ?? arxivIdFromUrl(location.landing_page_url ?? '');
  if (arxivId) return { url: `https://arxiv.org/pdf/${arxivId}`, source: 'arXiv', kind: 'arxiv' };
  if (!location.is_oa || !url) return null;
  const kind: OpenCopyKind = location.source?.type === 'repository' ? 'repository' : 'publisher';
  return { url, source: location.source?.display_name || new URL(url).hostname, kind };
}

async function lookUpWork(doi: string, http: HttpClient, openAlexKey: string): Promise<OpenAlexWork | null> {
  const url = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?select=ids,locations,open_access`;
  const response = await http.get(url, openAlexKey ? { Authorization: `Bearer ${openAlexKey}` } : {});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Erro ${response.status} ao consultar a OpenAlex`);
  return (await response.json()) as OpenAlexWork;
}

const uniqueByUrl = (copies: OpenCopy[]) => copies.filter((c, i) => copies.findIndex((o) => o.url === c.url) === i);

/**
 * Every open copy of the work with this DOI that OpenAlex knows, in the order worth trying: arXiv, the
 * PubMed Central bucket, repositories, then the publisher (whose links often answer bot checks, not PDFs).
 *
 * Usage:
 *   const { copies, landingPages } = await findOpenCopies('10.2337/dc11-s062', fetchHttpClient, '');
 */
export async function findOpenCopies(doi: string, http: HttpClient, openAlexKey = ''): Promise<OpenCopies> {
  const arxivId = arxivIdFromDoi(doi);
  const own: OpenCopy[] = arxivId ? [{ url: `https://arxiv.org/pdf/${arxivId}`, source: 'arXiv', kind: 'arxiv' }] : [];
  const work = await lookUpWork(doi, http, openAlexKey);
  if (!work) return { copies: own, landingPages: [] };
  const pmcid = pmcidOf(work);
  const pmc = pmcid ? await pmcBucketCopy(pmcid, http) : null;
  const fromLocations = (work.locations ?? []).map(locationCopy).filter((c): c is OpenCopy => c !== null);
  const copies = uniqueByUrl([...own, ...(pmc ? [pmc] : []), ...fromLocations]).sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  const landingPages = [
    ...new Set((work.locations ?? []).filter((l) => l.is_oa && l.landing_page_url).map((l) => l.landing_page_url!)),
  ];
  return { copies, landingPages };
}
