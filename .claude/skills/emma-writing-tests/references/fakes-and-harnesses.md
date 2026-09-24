# Test doubles and harnesses (emmas_librarian)

Paths are relative to `emmas_librarian/`. Prefer these over new ad-hoc mocks.

## Renderer (src/)

### FakeProjectService — `src/services/__tests__/fakes/FakeProjectService.ts`
Implements `IProjectService` with a `vi.fn()` per method and sensible defaults. Inject it through the provider:

```tsx
const service = FakeProjectService.create();
render(
  <ServicesProvider apiService={service}>
    <MemoryRouter><MyComponent /></MemoryRouter>
  </ServicesProvider>,
);
service.getProjects.mockResolvedValue([{ id: 2, name: 'Origem', created_at: '' }]);
await screen.findByRole('option', { name: 'Origem' });
expect(service.updateArticleMetadata).toHaveBeenCalledWith(1, expect.objectContaining({ year: 2021 }));
```

Some older suites mock `../../services/api` as `{ projectService: {} }` and `Object.assign` the fake into it
(for components that still import `projectService` directly). New code should use `useProjectService()` so the
provider pattern works. If you `rerender`, pass the **same provider tree** (build it with a `withProviders(ui)`
helper) — a different tree remounts the component and resets its state.

### FakeElectronApi — `src/services/__tests__/fakes/FakeElectronApi.ts`
Stands in for `window.electronAPI` when testing `src/services/api.ts` itself (`FakeElectronApi.install()`,
`respondWith(channel, value)`, `failWith(channel, error)`, `lastInvocation()`). `window.electronAPI` is
non-configurable in the test setup — the fake assigns, it does not redefine.

### FakeMdxEditor — `src/components/__tests__/fakes/FakeMdxEditor.tsx`
Replaces the MDXEditor (diary) with a textarea exposing the same contract (`markdown`, `onChange`, `readOnly`,
ref `setMarkdown`/`getMarkdown`); the real editor is Lexical/contentEditable, which jsdom cannot drive.

### projectPageHarness — `src/pages/__tests__/support/projectPageHarness.tsx`
Renders the whole `ProjectDetailsPage` with a `FakeProjectService`; use it for page-level flows:
`const service = givenProject([article({ id: 1, title: 'A' })]); await renderProjectPage(service);`
then query `mainTable()`. `PROJECT` is the default project row.

Mock the MDXEditor with `vi.mock('@mdxeditor/editor', async () => (await import('./fakes/FakeMdxEditor')).fakeMdxEditorModule)`.

## Main process (electron/)

### Real SQLite (preferred for data code)
```ts
const adapter = new DatabaseAdapter(':memory:'); // runs the real schema + migrations
afterEach(() => adapter.close());
```
For file-based scenarios (backups, legacy DB migrations) create the DB in `fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))`.
`electron/database/__tests__/support/fullProjectFixture.ts` seeds a project with a row in every table and
`expectFullProjectCopied(db, id)` checks every column and remapped foreign key — use it for anything that copies
projects (import, export, merge).

When the suite needs Electron's `app`/`dialog`, mock only those:
```ts
const electron = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ safeStorage: {}, app: { getPath: () => electron.userData }, dialog: { showSaveDialog: vi.fn() } }));
```

### IPC harness — `electron/ipc/__tests__/fakes/`
- `FakeIpcMain`: records `handle(channel, fn)`; `invoke(channel, ...args)` calls it like the renderer would.
- `FakeFileSystem`: in-memory fs for handlers that copy files.
- `RecordingDouble` (`createRecordingDouble()`): a Proxy where every property is a `vi.fn()` — use for the DB
  adapter in *handler* tests (routing/validation), never for data-correctness tests.
- `ipcHarness.ts`: wires all of the above; `resetIpcHarness()` + `setupIpcRegistries()` in `beforeEach`, then
  `await invoke(IpcChannel.X, ...)`. There is a contract test that every `IpcChannel` has exactly one handler.

## Adding a new double
Name it `Fake<Thing>`, put it in the nearest `__tests__/fakes/`, give it a docstring with a usage example, and
make it implement the real interface so TypeScript catches drift.
