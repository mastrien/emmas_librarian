import { describe, it, expect } from 'vitest';
import { pdfLinkFromLandingPage } from '../landingPagePdf';
import { FakeWeb } from './fakes/FakeWeb';

const PAGE = 'https://gmd.copernicus.org/articles/19/5207/2026/';
const pageWith = (meta: string) => `<!DOCTYPE html><html><head>${meta}</head><body></body></html>`;

describe('pdfLinkFromLandingPage', () => {
  it('reads the citation_pdf_url meta tag, in either attribute order', async () => {
    const pdf = 'https://gmd.copernicus.org/articles/19/5207/2026/gmd-19-5207-2026.pdf';
    const web = new FakeWeb()
      .on(PAGE, pageWith(`<meta name="citation_pdf_url" content="${pdf}">`))
      .on(`${PAGE}b`, pageWith(`<meta content='${pdf}' name='citation_pdf_url' />`));

    expect(await pdfLinkFromLandingPage(PAGE, web)).toBe(pdf);
    expect(await pdfLinkFromLandingPage(`${PAGE}b`, web)).toBe(pdf);
    expect(web.requested[0].headers).toEqual({ Accept: 'text/html' });
  });

  // OJS journals (e.g. MAUSAM) write the link with an HTML-escaped query string or relative to the page.
  it('unescapes &amp; and resolves a relative link against the page', async () => {
    const web = new FakeWeb().on(
      PAGE,
      pageWith('<meta name="citation_pdf_url" content="download/6571/5900?a=1&amp;b=2">'),
    );

    expect(await pdfLinkFromLandingPage(PAGE, web)).toBe(`${PAGE}download/6571/5900?a=1&b=2`);
  });

  it('gives null for a page without the tag, a page that does not answer and a malformed link', async () => {
    const web = new FakeWeb()
      .on(PAGE, pageWith('<meta name="citation_title" content="x">'))
      .on(`${PAGE}blocked`, 'Forbidden', 403)
      .on(`${PAGE}bad`, pageWith('<meta name="citation_pdf_url" content="http://[broken">'));

    expect(await pdfLinkFromLandingPage(PAGE, web)).toBeNull();
    expect(await pdfLinkFromLandingPage(`${PAGE}blocked`, web)).toBeNull();
    expect(await pdfLinkFromLandingPage(`${PAGE}bad`, web)).toBeNull();
  });
});
