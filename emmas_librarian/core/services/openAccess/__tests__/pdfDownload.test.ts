import { describe, it, expect } from 'vitest';
import { downloadPdf } from '../pdfDownload';
import { BOT_CHECK_HTML, FakeWeb, PDF_BYTES } from './fakes/FakeWeb';

const URL_ = 'https://example.org/paper.pdf';

describe('downloadPdf', () => {
  it('accepts a body that starts with %PDF-', async () => {
    const result = await downloadPdf(URL_, new FakeWeb().on(URL_, PDF_BYTES));

    expect(result).toEqual({ ok: true, bytes: PDF_BYTES });
  });

  // Seen with NEJM and Diabetes Care links: HTTP 200 and a ".pdf" URL, but the body is a bot check page.
  it('refuses an HTML page served under a PDF link', async () => {
    const result = await downloadPdf(
      URL_,
      new FakeWeb().on(URL_, BOT_CHECK_HTML, 200, { 'Content-Type': 'application/pdf' }),
    );

    expect(result).toEqual({ ok: false, reason: 'a página não entregou um PDF' });
  });

  it('reports an HTTP error and a file above 50 MB', async () => {
    expect(await downloadPdf(URL_, new FakeWeb().on(URL_, 'x', 403))).toEqual({ ok: false, reason: 'HTTP 403' });
    expect(
      await downloadPdf(URL_, new FakeWeb().on(URL_, PDF_BYTES, 200, { 'Content-Length': String(60 * 1024 * 1024) })),
    ).toEqual({ ok: false, reason: 'arquivo maior que 50 MB' });
  });

  it('asks for a PDF', async () => {
    const web = new FakeWeb().on(URL_, PDF_BYTES);

    await downloadPdf(URL_, web);

    expect(web.requested[0].headers).toEqual({ Accept: 'application/pdf' });
  });
});
