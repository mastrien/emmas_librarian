# E2E coverage map

Update this table when you add or extend a spec.

| Spec | Flow | Key assertions |
|---|---|---|
| `pdf_import.spec.js` (F-04) | Batch PDF import | alert text, row, stored copy in app storage |
| `semantic_search.spec.js` (F-05) | Bibliographic search (mocked E2eMockApiIntegrator): review, discard, search again, save, reopen from history | result listed in the review dialog; discard leaves the project empty; saved row author/year; a result title opens its metadata; "Nova busca a partir desta" brings the term back; AUTORES column hidden with the filters sidebar open and shown when closed (container query); a common limit above a base ceiling blocks "Fazer Busca" with the base named; common 1.500 + Crossref 300 shown per base, recorded in the history ("1.500 por base (Crossref 300)", "Únicos entre as bases") and restored by "Nova busca a partir desta" |
| `export.spec.js` (F-06) | Manual article with accents, exported to CSV, XLSX and Biblioshiny | confirmation alert per export; CSV starts with a BOM, exact header, one row; XLSX sheet "Artigos" row; Biblioshiny 45 columns |
| `questionnaire.spec.js` (F-07) | AI investigation + question set + history | catalog, completion, history details |
| `ai_config.spec.js` (F-08) | OpenAI key settings | saved + persisted across navigation |
| `project_sharing.spec.js` (F-17) | "Pacote .emmapcarc" export, sender's data deleted, Dashboard "Importar" in another installation | export alert with the path; "(Importado)" project with the article; its PDF opens |
| `backup.spec.js` (F-09) | Full backup creation | alert, real `.emmabak` with emma.db + metadata |
| `error_flows.spec.js` (F-10) | Duplicate project name | error, stays on form, no second project |
| `categories.spec.js` (F-11) | Create text/list/boolean categories, classify in the reader, Categories tab, CSV | values after reload, CSV columns |
| `backup_restore.spec.js` (F-12) | "Restaurar e Sobrescrever" | library equals backup, PDF deleted from disk comes back and opens |
| `backup_restore.spec.js` (F-14) | "Restaurar e Sobrescrever" into another data folder (old one deleted) | restored PDF still opens in the reader (paths rebased to this userData) |
| `backup_restore.spec.js` (F-13) | "Importar e Mesclar" into another library | project + PDF merged, second merge imports nothing |
| `sharing_and_pdf_library.spec.js` (F-15/16) | Import from other project; PDF library reuse; "Vincular" dialog | history ID; "Utilizado em 1/2 artigos"; link overlay covers the whole window (fixed-overlay regression) |
| `reader.spec.js` | Reader: render/paginate/zoom, in-PDF search, highlight with note, standalone annotation, ABNT citation from metadata | page input, results on page 3, persisted after reopening, citation text, saved title |
| `diary.spec.js` | Diary: autosave + reload, version history restore, delete page | content after reload, restored version, empty state |
| `agenda.spec.js` | Agenda event with custom milestone, views, dashboard banner | card, milestone list, banner |
| `article_table_layout.spec.js` | Project article table with extreme content (unbreakable URL title, 18 authors) at 900/1000/1200/1366px, filters sidebar open and closed | table never wider than its container (no horizontal scroll) |
| `article_filters.spec.js` | Project filters sidebar + result line + multi-select at 1000px: "Com PDF" filter, remove chip, select 2, archive with one reason, reload | filter bar and result line on one line; "0 de 3 artigos" and the chip; batch bar count; both archived rows show the shared "Motivo" after reload |
| `mass_investigation.spec.js` | Regression: article checkbox state across re-renders | checkbox stays unchecked |
| `playwright_e2e.test.js` | Manual article, details, mocked search | details show authors, result row |

## Not covered yet (candidates)
- Mass citation (ABNT/APA list, copy) and the citation modal from the project table.
- Editing/deleting highlights and annotations; AI summary ("Insights IA", needs a mock like `E2E_MOCK_AI_EXTRACTION`).
- Restore from an automatic backup (Settings → histórico de backups automáticos).
- Project export/import `.emmapcarc` through the UI (covered only by integration tests).
- Quick access links/documents, trash (restore/delete permanently), search history revert.
