import type { HttpClient, HttpResponse } from '../../httpClient';

type Body = string | Buffer | object;

interface Route {
  status: number;
  body: Body;
  headers: Record<string, string>;
}

/** A real PDF's first bytes, enough for the "%PDF-" check. */
export const PDF_BYTES = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
/** What publishers behind Cloudflare answer to a program asking for their ".pdf" URL. */
export const BOT_CHECK_HTML = '<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>';

/**
 * Named fake of the web for the open access download: each URL answers what the test registered (JSON,
 * text or bytes, with a status and headers); anything else is a 404. Records every URL asked, in order.
 *
 * Usage:
 *   const web = new FakeWeb().on('https://arxiv.org/pdf/2601.00001', PDF_BYTES);
 *   await downloadPdf('https://arxiv.org/pdf/2601.00001', web);
 */
export class FakeWeb implements HttpClient {
  readonly requested: { url: string; headers: Record<string, string> }[] = [];
  private readonly routes = new Map<string, Route>();

  on(url: string, body: Body, status = 200, headers: Record<string, string> = {}): this {
    this.routes.set(url, { status, body, headers });
    return this;
  }

  /** Answers the OpenAlex lookup of `doi` with this work. */
  onOpenAlexWork(doi: string, work: object): this {
    return this.on(
      `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?select=ids,locations,open_access`,
      work,
    );
  }

  /** Makes the PMC bucket hold these versions of `pmcid`. */
  onPmcVersions(pmcid: string, versions: number[]): this {
    const prefixes = versions.map((v) => `<CommonPrefixes><Prefix>${pmcid}.${v}/</Prefix></CommonPrefixes>`).join('');
    return this.on(
      `https://pmc-oa-opendata.s3.amazonaws.com/?list-type=2&prefix=${pmcid}.&delimiter=/`,
      `<?xml version="1.0"?><ListBucketResult><Prefix>${pmcid}.</Prefix>${prefixes}</ListBucketResult>`,
    );
  }

  async get(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
    this.requested.push({ url, headers });
    const route = this.routes.get(url) ?? { status: 404, body: 'not found', headers: {} };
    const asBuffer = () =>
      Buffer.isBuffer(route.body)
        ? route.body
        : Buffer.from(typeof route.body === 'string' ? route.body : JSON.stringify(route.body));
    return {
      status: route.status,
      ok: route.status >= 200 && route.status < 300,
      header: (name) => route.headers[name] ?? null,
      json: async () => JSON.parse(asBuffer().toString('utf8')),
      text: async () => asBuffer().toString('utf8'),
      bytes: async () => asBuffer(),
    };
  }
}
