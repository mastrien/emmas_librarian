# Exhaustive Tests for Repositories
The exhaustive Vitest tests have been written to achieve 100% statement, branch, function, and line coverage for:
- `AnnotationRepository.ts`
- `HistoryRepository.ts`
- `TrashRepository.ts`

The test files have been placed in `electron/database/__tests__/`.
They use an in-memory `better-sqlite3` DB, load `schema.sql`, mock dependencies properly and test all execution paths, including errors and edge cases.
