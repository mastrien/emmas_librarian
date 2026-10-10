# E2E pitfalls already paid for

- **Native dialogs hang the test.** `window.electronAPI` is frozen by contextBridge; overriding `invoke` from
  `window.evaluate` does nothing. Use an `E2E_MOCK_*` variable handled in the main process.
- **Assertions inside `window.on('dialog', …)` never fail** if the dialog does not appear. Await
  `window.waitForEvent('dialog')` started *before* the click.
- **Changelog modal over the page.** In the dev build `app.getVersion()` returns Electron's version, and the
  layout shows "Novidades da Versão …" whenever `localStorage.last_seen_version` differs. `dismissChangelog`
  stores the running version; call it again after `window.reload()`.
- **The reader is full screen**: no navigation bar. `navigateTo(...)` from inside the reader fails; go back
  (`window.goBack()` + `waitForURL(/\/projects\/\d+/)`) first.
- **Text selection in the PDF**: select a line with the mouse on its `.textLayer span` (move to the left edge,
  down, move to the right edge in several steps, up); react-pdf-highlighter then shows the tip with "Destacar".
- **Lexical/MDX editor (diary)**: type with `keyboard.type` after clicking `[contenteditable="true"]`;
  `Control+A` then typing replaces the page. Autosave fires 2 s after the last keystroke ("Não salvo" disappears).
- **Locators matching outer containers**: `locator('div', { hasText })` also matches every ancestor; for "the
  card that holds this text and a button" filter by both and take `.last()` (innermost in document order).
- **Categories are edited only in the reader's "Categorizar" panel**; the project's Categories tab is
  read-only (it renders "Sim"/"Não" for booleans; exports keep the raw `true`/`false`).
- **Page snapshot in `error-context.md` is empty** when the failure happened after the window closed (e.g. test
  timeout): rerun the single test, or probe with screenshots.
- **Unit tests fail with `NODE_MODULE_VERSION` after an E2E run**: `npm run rebuild:node`.
- **Mixed line endings / backslashes in scripted edits** (Windows): prefer the Edit tool; heredocs have eaten
  `\n`, `\\` and backticks in this repo.
- **Every spec fails at once with "page crashed" / "Navigation failed because page crashed"**, in about 1 s,
  and launching `electron.exe dist-electron/electron/main.js` by hand logs `GPU process exited unexpectedly:
  exit_code=-2147483645` and `Render process gone`: the shell that starts the run cannot host Chromium's
  sandbox (seen when the run was started by an agent's shell; `--disable-gpu` alone does not help). Run with
  `E2E_ELECTRON_ARGS=--no-sandbox`. It is a property of the launching environment, not of the app.
- **Reading the main process stdout of a startup that quits by itself** (recovery boxes answered by
  `E2E_MOCK_RECOVERY_CHOICE`): a listener on `electronApp.process().stdout` is attached after `electron.launch`
  returns, and on Linux the app had already printed and quit, so U-01 always saw an empty string although the
  recovery worked. Use `runAppUntilExit` from helpers.js (execFile, whole output) for startups without a window.
- **Linux CI**: Ubuntu 24.04 runners block the unprivileged user namespaces the Chromium sandbox needs; the
  workflow lifts it with `sysctl kernel.apparmor_restrict_unprivileged_userns=0` instead of `--no-sandbox`.
