# Test PDF fixture and E2E mocks

## The synthetic article — `e2e-tests/fixtures/artigo-teste-emma.pdf`

A 4-page fictitious scientific article in Portuguese (CC0; written for this project, all names and data
invented) with a real text layer (Helvetica, WinAnsi — accents are searchable in pdf.js).

- Content and metadata: `e2e-tests/fixtures/articleContent.cjs` (`METADATA`, `SENTINELS`, `BLOCKS`).
- Regenerate after editing the content: `node e2e-tests/fixtures/generate-article-pdf.cjs` (no dependencies).
  Explicit `pageBreak` blocks keep the layout deterministic: front matter + sections 1–2 on page 1, section 3 on
  page 2, section 4 (table + search sentinel) on page 3, sections 5–6 + references on page 4.
- `METADATA`: title, `shortTitle`, authors (`Ana Beatriz Lima; …` → ABNT `LIMA, Ana Beatriz`), journal, volume 12,
  issue 3, pages 101-106, year 2025, DOI `10.5555/emma.teste.2025.001` (10.5555 is Crossref's test prefix).
- `SENTINELS.search` ("índice de saturação teórica"): appears once, on page 3.
- `SENTINELS.highlight`: the first line of the abstract, used to create a highlight by mouse selection.
- Batch import names the article after the file: `IMPORTED_TITLE = 'artigo-teste-emma'`.

Helpers in `e2e-tests/articleFixture.js`:
```js
const fixture = copyFixturePdf();                       // temp copy; never hand the committed file to the app
const app = await launchApp({ E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath });
const window = await getFirstWindow(app);
await createProject(window, 'X ' + Date.now());
await importFixturePdf(window);                          // awaits "1 artigo(s) importado(s) com sucesso."
await openReader(window);                                // details → "Visualizar PDF" → waits for the text layer
// … finally: await app.close(); fixture.cleanup();
```

## Environment variables understood by the app

| Variable | Effect |
|---|---|
| `E2E_USER_DATA_DIR` | App data folder (set by `launchApp`; never point it at a real library) |
| `E2E_SKIP_RELAUNCH=true` | Backup restores only exit instead of relaunching (set by `launchApp`) |
| `E2E_MOCK_OPEN_FILE` | Path returned by the single-file open dialog (PDF attach) |
| `E2E_MOCK_OPEN_MULTIPLE_FILES` | `;`-separated paths returned by the multi-file dialog (batch PDF import) |
| `E2E_MOCK_SAVE_FILE_PATH` | Target of save dialogs: CSV/XLSX/text exports and "Criar Backup Completo" |
| `E2E_MOCK_BACKUP_FILE` | `.emmabak` chosen by "Restaurar e Sobrescrever" / "Importar e Mesclar" |
| `E2E_MOCK_SEARCH=true` | Bibliographic search returns one fixed article ("Aprendizado de Maquina E2E") |
| `E2E_MOCK_AI_EXTRACTION=true` | Mass AI extraction returns a canned answer (shape differs from `RAGExtractionResult`; the UI answer is not asserted yet) |

## Restore flows (relaunch on the same data)
```js
const dataDir = …;                                        // folder the test owns
const app = await launchApp(env, { userDataDir: dataDir });
// … "Restaurar e Sobrescrever": the app restores and exits (no relaunch under E2E)
const exited = app.waitForEvent('close');
await window.getByRole('button', { name: 'Restaurar e Sobrescrever' }).click();
await exited;
const again = await launchApp(env, { userDataDir: dataDir }); // verify the restored library here
```
