import fs from 'fs';
import { fetchHttpClient, type HttpClient, type HttpResponse } from './httpClient';

// The one open copy every E2E lookup finds; e2e-tests/open_access.spec.js asserts on its source name.
const E2E_COPY_URL = 'https://e2e.invalid/open-access/paper.pdf';

const response = (status: number, body: Buffer): HttpResponse => ({
  status,
  ok: status >= 200 && status < 300,
  header: () => null,
  json: async () => JSON.parse(body.toString('utf8')),
  text: async () => body.toString('utf8'),
  bytes: async () => body,
});

/**
 * E2E runs must not reach OpenAlex or publishers. This client answers every OpenAlex lookup with one open
 * repository copy ("Repositório E2E") whose download is the PDF at `pdfPath`; everything else is a 404.
 *
 * Usage:
 *   new OpenAccessService({ db, http: new E2eMockHttpClient('/fixtures/artigo.pdf'), storePdf });
 */
export class E2eMockHttpClient implements HttpClient {
  constructor(private readonly pdfPath: string) {}

  async get(url: string): Promise<HttpResponse> {
    if (url.startsWith('https://api.openalex.org/works/doi:')) {
      const work = {
        locations: [
          {
            is_oa: true,
            pdf_url: E2E_COPY_URL,
            landing_page_url: E2E_COPY_URL,
            source: { display_name: 'Repositório E2E', type: 'repository' },
          },
        ],
      };
      return response(200, Buffer.from(JSON.stringify(work)));
    }
    if (url === E2E_COPY_URL) return response(200, fs.readFileSync(this.pdfPath));
    return response(404, Buffer.from('not found'));
  }
}

/**
 * The HttpClient the open access download should use: the E2E mock when E2E_MOCK_OPEN_ACCESS_PDF names a PDF.
 *
 * Usage:
 *   const http = openAccessHttpClientFor(process.env);
 */
export function openAccessHttpClientFor(env: NodeJS.ProcessEnv): HttpClient {
  return env.E2E_MOCK_OPEN_ACCESS_PDF ? new E2eMockHttpClient(env.E2E_MOCK_OPEN_ACCESS_PDF) : fetchHttpClient;
}
