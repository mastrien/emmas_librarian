// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import { HistoryRepository } from '../../database/HistoryRepository';
import {
  EMPTY_NOTICE,
  LIMIT_NOTICE,
  SCOPE_NOTICE,
  searchReportMarkdown,
  searchReportRows,
  searchReportXlsx,
} from '../SearchReportService';
import type { SearchHistoryItem } from '../../types';

// A query with the characters a report could mangle: quotes, a pipe, parentheses and accents.
const OPENALEX_QUERY = 'title.search:("revisão sistemática" | "systematic review")';
const SCOPUS_QUERY = 'TITLE-ABS-KEY("revisão sistemática" OR "systematic review") AND PUBYEAR > 2019';
const CROSSREF_QUERY = 'revisão sistemática systematic review';

describe('search strategy report (#45), from a real search_history table', () => {
  let db: Database.Database;
  let repo: HistoryRepository;
  let projectId: number;

  function history(): SearchHistoryItem[] {
    return repo.getSearchHistory(projectId) as SearchHistoryItem[];
  }

  function setCreatedAt(id: number, createdAt: string): void {
    db.prepare('UPDATE search_history SET created_at = ? WHERE id = ?').run(createdAt, id);
  }

  function threeBaseSearch(): number {
    const id = repo.saveSearchHistory(
      projectId,
      'revisão sistemática',
      { openalex: OPENALEX_QUERY, scopus: SCOPUS_QUERY, crossref: CROSSREF_QUERY },
      2100,
      {
        openalex: { count: 1000, requested: 1000, available: 48211, requests: 10 },
        scopus: { count: 0, requested: 500, error: 'Chave de API inválida ou expirada' },
        crossref: { count: 120, requested: 1000, requests: 1, warning: 'A base parou antes do limite' },
      },
      { sortBy: 'relevance', limitVal: 1000, uniqueResults: 1100 },
    );
    setCreatedAt(id, '2026-10-16T13:05:00.000Z');
    return id;
  }

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf-8'));
    repo = new HistoryRepository(db);
    projectId = db.prepare("INSERT INTO projects (name) VALUES ('Tese')").run().lastInsertRowid as number;
  });

  afterEach(() => db.close());

  it('lists one row per base and per run, with the query exactly as sent to that base', () => {
    threeBaseSearch();

    const rows = searchReportRows(history());

    expect(rows.map((r) => [r.base, r.query])).toEqual([
      ['OpenAlex', OPENALEX_QUERY],
      ['Scopus', SCOPUS_QUERY],
      ['Crossref', CROSSREF_QUERY],
    ]);
    expect(rows[0]).toMatchObject({ run: 1, executedAt: '2026-10-16 13:05', sortBy: 'Relevância', available: 48211 });
  });

  it('marks a base that returned exactly its limit, and not one that failed or stopped short', () => {
    threeBaseSearch();

    const [openalex, scopus, crossref] = searchReportRows(history());

    expect(openalex).toMatchObject({ requested: 1000, returned: 1000, limitReached: true });
    expect(scopus).toMatchObject({ limitReached: false, note: 'Erro: Chave de API inválida ou expirada' });
    expect(crossref).toMatchObject({ limitReached: false, note: 'A base parou antes do limite' });
  });

  it('numbers runs oldest first and leaves out imports and manual additions, which have no query', () => {
    const later = threeBaseSearch();
    setCreatedAt(later, '2026-10-17T09:00:00.000Z');
    const earlier = repo.saveSearchHistory(projectId, 'q', { openalex: 'q' }, 5, { openalex: { count: 5 } });
    setCreatedAt(earlier, '2026-10-01T09:00:00.000Z');
    repo.saveSearchHistory(projectId, 'Importação', { import: 'Origem: Projeto ID 2' }, 3, { import: { count: 3 } });
    repo.saveSearchHistory(projectId, 'Adição manual', {}, 1, { Manual: { count: 1 } });

    const rows = searchReportRows(history());

    expect(rows.map((r) => [r.run, r.base])).toEqual([
      [1, 'OpenAlex'],
      [2, 'OpenAlex'],
      [2, 'Scopus'],
      [2, 'Crossref'],
    ]);
  });

  it('uses the common limit for searches recorded before each base had its own', () => {
    const id = repo.saveSearchHistory(
      projectId,
      'q',
      { openalex: 'q' },
      200,
      { openalex: { count: 200 } },
      {
        limitVal: 200,
      },
    );
    // The column default writes SQLite's "YYYY-MM-DD HH:MM:SS", in UTC.
    setCreatedAt(id, '2026-09-01 08:30:00');

    expect(searchReportRows(history())[0]).toMatchObject({
      requested: 200,
      limitReached: true,
      executedAt: '2026-09-01 08:30',
    });
  });

  it('writes an XLSX whose table and notes read back as written', () => {
    threeBaseSearch();

    const book = xlsx.read(searchReportXlsx(searchReportRows(history())), { type: 'buffer' });
    const table = xlsx.utils.sheet_to_json<(string | number)[]>(book.Sheets['Estratégia de busca'], { header: 1 });
    const notes = xlsx.utils.sheet_to_json<string[]>(book.Sheets['Notas'], { header: 1 });

    expect(book.SheetNames).toEqual(['Estratégia de busca', 'Notas']);
    expect(table[0]).toContain('Query enviada');
    expect(table).toHaveLength(4);
    expect(table[1]).toEqual([
      1,
      '2026-10-16 13:05',
      'OpenAlex',
      OPENALEX_QUERY,
      'Relevância',
      1000,
      1000,
      48211,
      'sim',
      '',
    ]);
    expect(notes.flat()).toEqual([LIMIT_NOTICE, SCOPE_NOTICE]);
  });

  it('exports a project without searches as the header and a notice, without error', () => {
    const rows = searchReportRows(history());
    const book = xlsx.read(searchReportXlsx(rows), { type: 'buffer' });
    const markdown = searchReportMarkdown(rows, 'Tese', new Date('2026-10-16T12:00:00Z'));

    expect(xlsx.utils.sheet_to_json(book.Sheets['Estratégia de busca'], { header: 1 })).toHaveLength(1);
    expect(markdown).toContain(EMPTY_NOTICE);
    expect(markdown).toContain('| Execução | Data (UTC) | Base |');
    expect(markdown).not.toContain('## Queries');
  });

  it('writes Markdown with the queries verbatim in fenced blocks and table cells that cannot break', () => {
    threeBaseSearch();

    const markdown = searchReportMarkdown(searchReportRows(history()), 'Tese', new Date('2026-10-16T12:00:00Z'));

    expect(markdown.split('\n')[0]).toBe('# Estratégia de busca: Tese');
    expect(markdown).toContain(`> ${LIMIT_NOTICE}`);
    expect(markdown).toContain(['**Execução 1, OpenAlex**', '', '~~~text', OPENALEX_QUERY, '~~~'].join('\n'));
    expect(markdown).toContain('| 1 | 2026-10-16 13:05 | OpenAlex | Relevância | 1000 | 1000 | 48211 | sim |  |');
  });
});
