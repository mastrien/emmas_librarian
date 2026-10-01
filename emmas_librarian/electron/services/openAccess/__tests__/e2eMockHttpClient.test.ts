// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { E2eMockHttpClient, openAccessHttpClientFor } from '../e2eMockHttpClient';
import { fetchHttpClient } from '../httpClient';
import { findOpenCopies } from '../openCopies';
import { downloadPdf } from '../pdfDownload';

let dir: string;
let pdfPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-e2e-oa-'));
  pdfPath = path.join(dir, 'fixture.pdf');
  fs.writeFileSync(pdfPath, '%PDF-1.4 fixture');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('E2eMockHttpClient', () => {
  it('finds one repository copy for any DOI and hands over the fixture PDF', async () => {
    const http = new E2eMockHttpClient(pdfPath);

    const { copies } = await findOpenCopies('10.1234/qualquer', http);
    const download = await downloadPdf(copies[0].url, http);

    expect(copies).toEqual([
      { url: 'https://e2e.invalid/open-access/paper.pdf', source: 'Repositório E2E', kind: 'repository' },
    ]);
    expect(download.ok && download.bytes.toString()).toBe('%PDF-1.4 fixture');
  });

  it('answers 404 to anything else', async () => {
    const response = await new E2eMockHttpClient(pdfPath).get('https://example.org/x');

    expect([response.status, await response.text()]).toEqual([404, 'not found']);
  });
});

describe('openAccessHttpClientFor', () => {
  it('uses the mock only when E2E_MOCK_OPEN_ACCESS_PDF names a PDF', () => {
    expect(openAccessHttpClientFor({ E2E_MOCK_OPEN_ACCESS_PDF: pdfPath })).toBeInstanceOf(E2eMockHttpClient);
    expect(openAccessHttpClientFor({})).toBe(fetchHttpClient);
  });
});
