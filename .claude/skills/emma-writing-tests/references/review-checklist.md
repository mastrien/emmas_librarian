# Test review checklist

Run this over every test file you created or changed. A "no" means fix it now — it is what a future audit
would flag.

## Does it test anything?
- [ ] Every `it` has at least one assertion on an observable outcome (screen, service call arguments, DB row,
      file on disk, IPC payload) — not only "it rendered" / "container exists".
- [ ] No assertion lives only inside an event handler/callback that might never run (await the event instead).
- [ ] Deleting or breaking the feature code would make at least one test fail. For a bug fix, the regression test
      was seen failing before the fix.
- [ ] Exact-output checks use exact matchers (`toBe`, `toEqual`), not substring matchers, where the difference
      matters (formatting, separators, counts).

## Is it the right level?
- [ ] Data/persistence code runs against real SQLite (and real zip/fs in a temp dir), not mocked query chains.
- [ ] The component gets its service via `ServicesProvider` + a named fake, not an inline stub or a `vi.mock` of
      the api module (unless it is an older suite that already works that way).
- [ ] Private helpers are tested through the public contract; `(obj as any).privateMethod` is a smell — test the
      public behavior or extract the helper into its own module with its own test.

## Is it stable?
- [ ] Zero `act(...)` warnings when running the file.
- [ ] Timers are pure fake timers with `setSystemTime`, restored after; no real waiting (`setTimeout` sleeps).
- [ ] Temp files/dirs are created per test and removed; no dependence on the developer machine's data.
- [ ] Mocks/spies are restored (`vi.restoreAllMocks()` / `mockRestore()`); console spies only where the test
      expects an error to be logged (and it asserts that log).
- [ ] Passes when run alone and with the whole suite (no order dependence).

## Is it readable?
- [ ] Test names describe behavior in plain language; `describe` blocks group by feature.
- [ ] Arrange / act / assert separated by blank lines; helpers named for intent (`renderModal`, `openEditor`).
- [ ] Comments explain *why* for non-obvious setup (jsdom workaround, pending promise, node environment).

## Gates
- [ ] `npm run typecheck`, `npm run coverage` (thresholds), `npm run lint:ci` pass.
- [ ] Thresholds / warning cap ratcheted if the numbers improved.
