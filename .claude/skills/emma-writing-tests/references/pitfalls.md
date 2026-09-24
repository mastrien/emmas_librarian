# Pitfalls already paid for (and the fix)

Each of these cost time during the audit. Check here before debugging a strange test failure.

## Async / React
- **act() warning** → something resolved after the test's last `await`. Fix by awaiting the visible result
  (`await screen.findByText(...)`). `afterEach(async () => act(async () => {}))` does *not* help: the promise
  settles in the microtasks right after the test body, before any `afterEach` runs.
- **Incidental loads** (a child component fetching data you don't assert on): make that fake method return
  `new Promise(() => undefined)` so it never updates state.
- **`vi.waitFor` vs `waitFor`**: only Testing Library's `waitFor`/`findBy*` wrap in `act`.
- **Hooks after an early return**: going from 0 hooks to N does not throw (React treats it as a mount), so a
  "render closed → open" test passes even with the bug when *all* hooks are below the return. It does crash when
  some hooks are above and some below. Fix the code (wrapper + `…Content` component); keep the test for behavior.
- **Fake timers**: `vi.useFakeTimers({ shouldAdvanceTime: true })` makes boundary assertions flaky — use pure fake
  timers and `act(() => vi.advanceTimersByTime(ms))`. Always `vi.useRealTimers()` in `afterEach`.
- **`vi.restoreAllMocks()`** also resets mocks created in `src/setupTests.ts` (e.g. `getPathForFile`); spy again
  in the test if you need them.

## jsdom limitations
- `Blob.prototype.text()` is missing → read with `FileReader` (`readAsText`).
- `ClipboardItem` is missing → `vi.stubGlobal('ClipboardItem', FakeClipboardItem)`; `navigator.clipboard` via
  `Object.defineProperty(navigator, 'clipboard', { value: fake, configurable: true })`.
- Drag events carry no `clientY` (jsdom has no `DragEvent`) → `const ev = createEvent.dragOver(el);
  Object.defineProperty(ev, 'clientY', { value: -1 }); fireEvent(el, ev);`. Rects are all zero.
- `toHaveStyle` cannot resolve CSS `var(--x)` → assert `element.style.border` directly.
- **AdmZip reads back empty entries under jsdom** (Buffer realm mismatch). Suites that build/read real zips start
  with `// @vitest-environment node`. `src/setupTests.ts` guards its `window` usage so such suites work.

## Matchers that lie
- `toHaveTextContent('p. 3-4')` is a *substring* match — it passed for ", p. 3-4". Use
  `expect(el.textContent).toBe('p. 3-4')` when exact output matters.
- `getByDisplayValue` normalizes whitespace; keep a reference to the input to assert raw values.
- JSX entities need the semicolon: `&gt 200` renders literally. Assert user-visible text, which catches this.

## Files and tooling on Windows
- Many files mix CRLF and LF. Scripted edits must split on `/\r?\n/` and keep each line's separator, or line
  numbers from ESLint/Vitest will not match.
- In Git Bash, arguments that look like paths (`</div>`) get rewritten; prefix the command with
  `MSYS_NO_PATHCONV=1`. Prefer the Edit tool for multi-line or backslash-heavy edits (heredocs have eaten `\\`
  and `\n` escapes in this repo).
- An E2E run rebuilds better-sqlite3 for Electron → `npm run rebuild:node` before Vitest.

## Data code
- A mocked `db.prepare(...).run(...)` cannot tell you a column does not exist. Use real SQLite.
- Copying rows between schemas: copy by column intersection and override only ids/foreign keys
  (`electron/database/backup/rowCopy.ts`), and cover it with `fullProjectFixture`.
- Soft delete: most lists filter `deleted_at IS NULL`; tests that count rows must account for trashed ones.
