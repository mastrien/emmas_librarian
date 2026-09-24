# E2E coverage map

Update this table when you add or extend a spec.

| Spec | Flow | Key assertions |
|---|---|---|
| `pdf_import.spec.js` (F-04) | Batch PDF import | alert text, row, stored copy in app storage |
| `semantic_search.spec.js` (F-05) | Bibliographic search (mocked) | saved count in summary, row author/year |
| `export.spec.js` (F-06) | Manual article + CSV export | exact header, single row |
| `questionnaire.spec.js` (F-07) | AI investigation + question set + history | catalog, completion, history details |
| `ai_config.spec.js` (F-08) | OpenAI key settings | saved + persisted across navigation |
| `backup.spec.js` (F-09) | Full backup creation | alert, real `.emmabak` with emma.db + metadata |
| `error_flows.spec.js` (F-10) | Duplicate project name | error, stays on form, no second project |
| `categories.spec.js` (F-11) | Create text/list/boolean categories, classify in the reader, Categories tab, CSV | values after reload, CSV columns |
| `backup_restore.spec.js` (F-12) | "Restaurar e Sobrescrever" | library equals backup, PDF deleted from disk comes back and opens |
| `backup_restore.spec.js` (F-13) | "Importar e Mesclar" into another library | project + PDF merged, second merge imports nothing |
| `sharing_and_pdf_library.spec.js` (F-15/16) | Import from other project; PDF library reuse | history ID; "Utilizado em 1/2 artigos" |
| `reader.spec.js` | Reader: render/paginate/zoom, in-PDF search, highlight with note, standalone annotation, ABNT citation from metadata | page input, results on page 3, persisted after reopening, citation text, saved title |
| `diary.spec.js` | Diary: autosave + reload, version history restore, delete page | content after reload, restored version, empty state |
| `agenda.spec.js` | Agenda event with custom milestone, views, dashboard banner | card, milestone list, banner |
| `mass_investigation.spec.js` | Regression: article checkbox state across re-renders | checkbox stays unchecked |
| `playwright_e2e.test.js` | Manual article, details, mocked search | details show authors, result row |

## Not covered yet (candidates)
- Mass citation (ABNT/APA list, copy) and the citation modal from the project table.
- Editing/deleting highlights and annotations; AI summary ("Insights IA", needs a mock like `E2E_MOCK_AI_EXTRACTION`).
- Restore from an automatic backup (Settings → histórico de backups automáticos).
- Project export/import `.emmapcarc` through the UI (covered only by integration tests).
- Quick access links/documents, trash (restore/delete permanently), search history revert.
