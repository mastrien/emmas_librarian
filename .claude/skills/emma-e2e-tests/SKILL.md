---
name: emma-e2e-tests
description: How to write, run and debug the Playwright end-to-end tests of the emmas_librarian Electron app (e2e-tests/*.spec.js). Use this whenever a change touches a user-facing flow (projects, import, PDF reader, highlights, citations, diary, categories, search, export, backup/restore, settings), when adding or fixing an E2E spec, when an E2E run fails or is flaky, or when you need the synthetic test PDF — even if the user only asked for the feature. Pair it with the emma-writing-tests skill for unit/integration tests.
---

# End-to-end tests for Emma's Librarian

E2E specs drive the real Electron app with Playwright (`_electron.launch`) against the Vite dev server.
They exist to catch what unit tests cannot: wiring between screens, real pdf.js rendering, real SQLite and
files on disk. The first real E2E coverage of the reader found two production bugs in one run (creating a
highlight crashed the viewer; in-PDF search reloaded the page and never ran) — both hidden behind stubbed
callbacks and `as any` in unit tests. Treat a failing E2E as a probable app bug until proven otherwise.

## Running

From `emmas_librarian/`:

| Goal | Command |
|---|---|
| Whole suite (rebuilds native deps for Electron, compiles main, starts Vite) | `npm run test:e2e` |
| One or more specs, no retries (fast feedback) | see below |
| Back to unit tests afterwards | `npm run rebuild:node` (the E2E run rebuilt better-sqlite3 for Electron) |

```bash
npm run rebuild:electron && npx tsc -p tsconfig.electron.json && \
npx concurrently --kill-others --success first "vite" \
  "wait-on http://localhost:5173 && npx playwright test e2e-tests/reader.spec.js --config=playwright.config.js --workers=1 --retries=0"
```
Add `-g "<test name>"` to run a single test. `tsc -p tsconfig.electron.json` is required after any change in
`electron/` (the specs launch `dist-electron/electron/main.js`); renderer changes are served live by Vite.
Each spec opens real app windows, one at a time; runs need a desktop session (they refuse to run headless).

## Safety: data isolation (do not bypass)

`helpers.launchApp(env, { userDataDir })` starts the app with `E2E_USER_DATA_DIR` pointing at a fresh temp folder
that is deleted on close, and `E2E_SKIP_RELAUNCH=true`. Before this existed, the suite ran against the
installed app's real library (`%APPDATA%/<app>`). Always launch through `launchApp`. Pass your own
`userDataDir` only when a test must relaunch on the same data (restore flows) — you then own its cleanup.

## Writing a spec

1. Reuse the helpers: `launchApp`, `getFirstWindow` (auto-accepts dialogs, dismisses the changelog),
   `createProject`, `navigateTo`, `clickAddArticlesOption` in `e2e-tests/helpers.js`; and for anything that
   needs a real PDF, `copyFixturePdf`, `importFixturePdf`, `openReader` and the `METADATA`/`SENTINELS` constants
   in `e2e-tests/articleFixture.js` (details in `references/fixture-and-mocks.md`).
2. Replace native OS dialogs with the `E2E_MOCK_*` environment variables (list in
   `references/fixture-and-mocks.md`). Never try to monkey-patch `window.electronAPI` from the test:
   contextBridge freezes it, the patch silently does nothing, and the test then waits on a native dialog.
   If a flow needs a dialog that has no mock yet, add an env override next to the dialog call in the main
   process (pattern: `process.env.E2E_MOCK_X || await dialog.show…`) with a unit test.
3. Assert outcomes the user or the system would notice: text on screen, a value surviving `window.reload()`
   or reopening a screen, the file written to disk (read it with `fs`), the alert message. A test that only
   clicks through a flow proves nothing.
4. Wait for events instead of asserting inside handlers: `const d = window.waitForEvent('dialog'); await click;
   expect((await d).message())…`. Assertions inside `window.on('dialog')` pass when the dialog never appears.
5. Locate by role/label/placeholder/title/test id (`getByRole('button', { name })`, `getByTestId('tab-diary')`).
   If an icon-only control has no accessible name, add `title` + `aria-label` in the component — it is an
   accessibility fix and gives the test a stable handle.
6. Keep each `test()` independent (own launch, own project). Use `test.setTimeout` for multi-launch tests.
7. Clean up temp files in `finally` (fixture copies, CSV/backup targets, owned data folders).

## Debugging a failure

- Read `test-results/<test>/error-context.md`: it has the error, the failing line and an accessibility snapshot of
  the page at that moment (e.g. it showed "Erro ao carregar o PDF" for the highlight bug).
- Renderer console errors are echoed as `BROWSER CONSOLE`/`BROWSER ERROR` in the output; grep them.
- If you cannot see what happens, write a throwaway probe spec (not committed) that takes
  `window.screenshot({ path })` after each step and logs events (`window.on('framenavigated')` revealed the
  search form reloading the page), then open the screenshots with the Read tool.
- Known pitfalls and their fixes: `references/pitfalls.md`.

## Coverage map

`references/coverage-map.md` lists which user flows each spec covers and what is still uncovered. Update it
when you add a spec, and prefer extending an existing spec's flow over a near-duplicate spec.
