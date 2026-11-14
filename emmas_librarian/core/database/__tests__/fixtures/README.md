# Libraries written by released versions

`library_v1_1_11.sql` and `library_v1_1_23.sql` are real databases: the same data written through the data
layer of each tagged release, then dumped to SQL. `DatabaseAdapter.releasedLibraries.test.ts` opens them with
today's code to check that an upgrade keeps the data.

- **v1.1.11**: last release before `deleted_at` (v1.1.12). Since v1.1.20 `schema.sql` indexes
  `WHERE deleted_at IS NULL`, so this library did not open until columns were migrated before `schema.sql`.
  Categories are still comma-separated text.
- **v1.1.23**: last published release before v1.2.0.

Hand-made "old" schemas in other tests guess what a release left behind; these files are what it did leave.

## Regenerating (or adding another release)

1. `git worktree add ../fx_vX.Y.Z vX.Y.Z` and point its `emmas_librarian/node_modules` at this checkout's
   (`mklink /J`); keep the path ASCII-only, or node-gyp fails.
2. Save the seed below as `electron/zz_seed.test.ts` in the worktree. Write through each release's API the way
   its UI did. v1.1.11 differs in two places: it has no `DatabaseAdapter` (import `DatabaseManager` from
   `./database/DatabaseManager`), and enum options are a comma-separated string (`'Quantitativo,Qualitativo'`)
   instead of `[{ name }]`. Passing the old string to v1.1.23 creates a category with no options.
3. `FX_DB=C:\fx\vX.Y.Z.db npx vitest run electron/zz_seed.test.ts` inside the worktree's `emmas_librarian`.
4. Dump with the script below (`NODE_PATH=<this checkout>/node_modules node dump.js <this fixtures folder>`).

```ts
import { it } from 'vitest';
import { DatabaseAdapter as Db } from './database/DatabaseAdapter';
it('seeds a library through the v1.1.23 data layer', () => {
  const db = new Db(process.env.FX_DB as string);
  const p = db.createProject('Revisão sistemática');
  db.updateProjectWritingPad(p.id, '# Rascunho');
  const sid = db.saveSearchHistory(p.id, 'TITLE("machine learning")', { scopus: 'TITLE("machine learning")' }, 2, {
    scopus: 2,
  });
  const csl = JSON.stringify({ title: 'Artigo aberto', is_oa: true, publisher: 'Editora A' });
  const a1 = db.saveArticle(p.id, {
    title: 'Artigo aberto',
    doi: '10.1000/a',
    authors: 'Silva, A.',
    year: 2024,
    abstract: 'Resumo',
    journal: 'Revista',
    source_query: 'q',
    source_databases: '["scopus"]',
    csl_json: csl,
    search_id: sid,
    is_oa: 1,
    publisher: 'Editora A',
  });
  const a2 = db.saveArticle(p.id, {
    title: "Artigo com 'aspas'",
    doi: '10.1000/b',
    source_query: 'q',
    source_databases: '["scopus"]',
    csl_json: '{}',
  });
  db.updateArticleStatus(a1, 'read');
  db.updateArticleStatus(a2, 'archived', 'fora do escopo');
  const an = db.saveAnnotation(a1, '## Nota\ncom acento: ção');
  db.saveHighlight(a1, 'yellow', '{"page":1,"rects":[]}', 'trecho destacado', an);
  db.savePendingHighlight(a1, 'citação', 'antes', 'depois', 'comentário');
  db.saveMassiveInvestigation(p.id, ['Qual o método?'], [a1, a2], 'modelo', 'completed');
  db.saveDiaryEntry(p.id, '2026-06-01', 'Primeiro dia');
  db.saveProjectDocument(p.id, 'Protocolo', 'https://example.org/protocolo');
  const enumCat = db.createProjectCategory(p.id, 'Método', 'enum', [{ name: 'Quantitativo' }, { name: 'Qualitativo' }]);
  db.setArticleCategory(a1, enumCat, 'Quantitativo');
  const textCat = db.createProjectCategory(p.id, 'Observação', 'text');
  db.setArticleCategory(a2, textCat, 'revisar depois');
  db.setSetting('theme', 'dark');
  (db as any).close?.();
});
```

```js
const D = require('better-sqlite3');
const fs = require('fs');
const q = (v) =>
  v === null
    ? 'NULL'
    : typeof v === 'number' || typeof v === 'bigint'
      ? String(v)
      : Buffer.isBuffer(v)
        ? "X'" + v.toString('hex') + "'"
        : "'" + String(v).replace(/'/g, "''") + "'";
for (const v of ['v1.1.11', 'v1.1.23']) {
  const db = new D('C:/root_lab/fx_out/' + v + '.db', { readonly: true });
  const out = [];
  out.push('-- Library written by the ' + v + ' data layer (git tag ' + v + '), dumped as SQL. Do not edit by hand:');
  out.push('-- regenerate as described in README.md next to this file.');
  out.push('PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;');
  for (const t of db
    .prepare("select name,sql from sqlite_master where type='table' and name not like 'sqlite_%' order by rowid")
    .all()) {
    out.push(t.sql + ';');
    for (const r of db
      .prepare('select * from "' + t.name + '"')
      .raw()
      .all())
      out.push('INSERT INTO "' + t.name + '" VALUES(' + r.map(q).join(',') + ');');
  }
  for (const r of db.prepare('select * from sqlite_sequence').all())
    out.push('INSERT INTO sqlite_sequence(name,seq) VALUES(' + q(r.name) + ',' + r.seq + ');');
  for (const i of db
    .prepare("select sql from sqlite_master where type='index' and sql is not null order by rowid")
    .all())
    out.push(i.sql + ';');
  out.push('COMMIT;');
  fs.writeFileSync(process.argv[2] + '/library_' + v.replace(/\./g, '_') + '.sql', out.join('\n') + '\n');
}
```
