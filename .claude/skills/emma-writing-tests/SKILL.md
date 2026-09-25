---
name: emma-writing-tests
description: How to write, fix and review Vitest unit/integration tests in the emmas_librarian app (Electron + React/TS, better-sqlite3). Use this whenever you add or change code in emmas_librarian/src or emmas_librarian/electron, fix a bug there, refactor or split a file, touch a test file, see act() warnings or flaky tests, or a coverage/lint gate fails — even if the user only asked for the feature and did not mention tests. Tests are written together with the change, never deferred to a later "test pass".
---

# Writing tests for Emma's Librarian

This project went through a multi-day test audit (report: `docs/auditoria/2026-09-21_cobertura_e_qualidade_testes.md`).
High line coverage hid real production bugs because tests mocked the thing that was broken, asserted nothing,
or leaked async work. The rules below exist so that no second audit is needed: every change leaves the suite
a little stronger than it found it.

## Commands (run from `emmas_librarian/`)

| Goal | Command |
|---|---|
| All unit/integration tests | `npm run test` |
| Coverage + thresholds (what CI runs) | `npm run coverage` |
| One file / pattern | `npx vitest run src/components/__tests__/Foo.test.tsx` |
| Types (CI + pre-commit) | `npm run typecheck` |
| Lint gate (CI) | `npm run lint:ci` |
| Uncovered lines of a file | run `npm run coverage`, then read `coverage/coverage-final.json` (statements with count 0) |

If Vitest fails with a better-sqlite3 `NODE_MODULE_VERSION` error, an E2E run rebuilt the native module for
Electron: run `npm run rebuild:node`. **Never run `npm run test:mutate`/`stryker run` unless the user explicitly
orders it** — a full run takes ~19h (it is configured as incremental; see `references/quality-gates.md`).

## The workflow for any change

1. **Look before you touch.** Check the file's current coverage and existing tests. If the code you will change
   is untested, first write *characterization tests* that pin today's behavior through its public contract
   (rendered UI, IPC handler, repository method) and commit them separately (`test: characterize …`). Then
   change the code; the same tests must still pass except where you deliberately change behavior.
2. **Bug fix = regression test that fails first.** Write the test, watch it fail against the current code
   (you can `git stash` the fix to prove it), then fix. Name the test after the behavior, not the bug ticket.
3. **New function/module = its own test.** Pure logic you extract (formatters, parsers, reducers, SQL helpers)
   gets a small unit test next to it, in addition to the integration test of the component that uses it.
4. **Finish clean:** `npm run typecheck`, the affected tests, then `npm run coverage` and `npm run lint:ci`
   before committing. Zero `act(...)` warnings in the output of the files you touched.
5. **Ratchet, never lower.** If coverage went up, raise the thresholds in `vitest.config.mts` to just below the
   new numbers; if lint warnings went down, lower `--max-warnings` in the `lint:ci` script.
6. Commit with a semantic message (`test:`, `fix:`, `refactor:`), tests and refactors in separate commits.

## Rules, and why each one exists

**Every test must be able to fail.** Assert the observable outcome (text on screen, value saved through the
service, row in the database, file on disk, argument sent over IPC). The audit found tests like
`expect(container).toBeInTheDocument()` and assertions placed inside event handlers that never fired — they passed
while the feature was broken. Before finishing a test, ask: "if I delete the feature code, does this go red?"

**Use the real thing for data code; fake only the boundary.** Repository, backup, import/export and migration
code must be tested against real SQLite (`new DatabaseAdapter(':memory:')` or a temp file) and, for archives,
real zip files. Mocked `prepare().run()` chains hid two production bugs: project import inserted into columns
that do not exist, and backup merge silently dropped most columns. Mock only what you cannot run in a test:
Electron `dialog`/`app`, network, the AI provider.

**Named fakes, injected — never inline stubs.** The UI gets its service from `useProjectService()`
(`ServicesProvider`), so tests pass `FakeProjectService`, not `vi.mock` of `services/api`. Existing doubles and
harnesses, with usage, are in `references/fakes-and-harnesses.md`. Reuse them; if a new external boundary
needs a double, add a named fake class there instead of an inline object.

**Wait for the final state; no act() warnings.** Every `act(...)` warning is an async update that happened after
your last assertion — i.e. the test did not wait for what the user would see. Use Testing Library's
`findBy*`/`waitFor` (not `vi.waitFor`, which is not wrapped in `act`). If a load is incidental to the test (e.g.
a catalog inside a modal you are not testing), make that fake return a never-resolving promise rather than
flushing in `afterEach` (that runs too late). Details in `references/pitfalls.md`.

**Hooks above every early return.** `if (!isOpen) return null` must come after all `useState`/`useEffect`,
or be moved into a wrapper that renders a `…Content` component. This crashed `ManageQuickAccessModal` on reopen.
Cover components that toggle `isOpen` with a "render closed, rerender open" test.

**Deterministic by construction.** Pure fake timers (`vi.useFakeTimers()` + `vi.setSystemTime(new Date(y, m, d, …))`
in local time), restored in `afterEach`; temp dirs via `fs.mkdtempSync(os.tmpdir())` and removed after; no
dependence on test order or on the machine's data.

**Name the behavior.** `it('keeps one empty question when the last one is removed')`, not `it('works')`.
Group with `describe` by feature area. One behavior per test, arrange/act/assert separated by blank lines.

## Where tests go

- `src/**/__tests__/X.test.tsx` next to the component/hook; `X.behavior.test.tsx` for characterization suites.
- `src/utils/__tests__/`, `src/hooks/*.test.ts` for pure helpers and hooks.
- `electron/**/__tests__/` for repositories, services and IPC handlers; `electron/database/__tests__/support/`
  for shared data fixtures (e.g. `fullProjectFixture.ts`).
- End-to-end flows: see the `emma-e2e-tests` skill.

## Before you say "done"

Run through `references/review-checklist.md` for every test file you created or changed. It is the condensed
form of the audit and takes a minute.
