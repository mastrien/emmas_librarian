// The service as the app builds it, end to end: E2E mock network, real SQLite and a temp PDF library.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const electron = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ safeStorage: {}, app: { getPath: () => electron.userData } }));

import { DatabaseAdapter } from '../../../database/DatabaseAdapter';
import { openAccessServiceFor } from '../openAccessServiceFor';

let dir: string;
let db: DatabaseAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-oa-factory-'));
  electron.userData = dir;
  db = new DatabaseAdapter(':memory:');
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('openAccessServiceFor', () => {
  it('downloads through the E2E mock and stores the PDF in the library of this database', async () => {
    const pdfPath = path.join(dir, 'fixture.pdf');
    fs.writeFileSync(pdfPath, '%PDF-1.4 fixture');
    const projectId = db.createProject('Tese').id;
    const articleId = db.saveArticle(projectId, {
      title: 'Aberto',
      doi: '10.1234/aberto',
      source_query: 'q',
      source_databases: '[]',
      csl_json: '{}',
    });

    const outcome = await openAccessServiceFor(db, { E2E_MOCK_OPEN_ACCESS_PDF: pdfPath }).fetchForArticle(articleId);

    expect(outcome).toEqual({ status: 'downloaded', source: 'Repositório E2E' });
    const stored = db.getArticle(articleId)!.local_file_path!;
    expect(path.dirname(stored)).toBe(path.join(dir, 'storage', 'pdfs'));
    expect(fs.readFileSync(stored, 'utf8')).toBe('%PDF-1.4 fixture');
  });
});
