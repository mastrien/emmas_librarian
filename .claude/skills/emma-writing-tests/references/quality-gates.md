# Quality gates and how to move them

## CI (`.github/workflows/test.yml`, Windows runner)
1. `npm ci`
2. `npm run typecheck`
3. `npm run lint:ci` — `eslint . --max-warnings N` (errors always fail; N is a ratchet, currently 344:
   mostly `no-explicit-any`, `react-hooks/set-state-in-effect`, `exhaustive-deps`)
4. `npm run coverage` — Vitest with v8 coverage and thresholds from `vitest.config.mts`
`release.yml` also runs typecheck + tests before building. The local git pre-commit hook runs typecheck only.

## Coverage thresholds (`vitest.config.mts`)
Global: lines/statements 90, branches 88, functions 83. `electron/**/*`: 94/90/94/94.
They are a ratchet set just below measured values. After your change improves coverage, raise them to
`floor(measured)` or one point below; never lower them to make a change pass — add the missing tests instead.
Note that deleting well-covered code or reformatting (more lines) can move the percentage; cover a real gap
rather than lowering the bar.

## Lint config (`.eslintrc.cjs`)
- `public/` (vendored bundles) is ignored.
- `react/prop-types` off (TypeScript types props); `no-unused-vars` accepts a leading `_`;
  `react/no-unescaped-entities` only forbids `>` and `}`.
- `react-hooks/set-state-in-effect` is a warning (known backlog). Do not add new occurrences; prefer a keyed
  remount for "reset form when opened" and a data hook for loads.
- `@ts-expect-error` needs a description (`// @ts-expect-error -- why`); `@ts-ignore` is banned.
- Empty `catch {}` blocks need a comment saying why ignoring is correct.

## Mutation testing (Stryker, `stryker.config.json`)
- **Only run with the user's explicit instruction.** `npm run test:mutate`.
- Incremental mode is on (`reports/stryker-incremental.json`): later runs only re-test mutants whose code or
  covering tests changed. `thresholds.break` is `null` (report only).
- Useful for a targeted check of one module: `npx stryker run --mutate "src/utils/cslMetadata.ts"` — still needs
  the user's go-ahead.
