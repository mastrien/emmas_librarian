# Test doubles and harnesses (emmas_librarian)

Paths are relative to `emmas_librarian/`. Prefer these over new ad-hoc mocks.

## Renderer (src/)

### FakeDialogs — `src/components/common/dialogs/__tests__/fakes/FakeDialogs.tsx`
Stands in for the app's confirm/message windows (`useDialogs`). Render with `<FakeDialogsProvider dialogs={dialogs}>`.
`confirmMessage` and `informMessage` are `vi.fn`s that receive the message, as `window.confirm`/`window.alert`
spies did: `dialogs.confirmMessage.mockReturnValue(false)` declines, `expect(dialogs.informMessage).toHaveBeenCalledWith(…)`
checks a message. `asked`/`informed` keep the full options (title, button names). E2E specs answer the real windows
with `answerAppDialog(window, title, button)` from `e2e-tests/helpers.js`.
The answer is a promise: to check that a declined question did nothing, wait for `dialogs.asked` to have the
question and flush with `await act(async () => {})` first; asserting right after the click passes even when the
check is gone (it did in `SettingsPage`, Arca 134).

### FakeCitationClipboard — `src/utils/__tests__/fakes/FakeCitationClipboard.ts`
Records what citation code copies (`texts`, `richWrites`; `rejectRich = true` makes rich copy fail). Pass it to
`copyCitations(…, clipboard)` or `useCitationCopy(clipboard)`; stub `ClipboardItem` with `FakeClipboardItem`.

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
`core/database/__tests__/support/fullProjectFixture.ts` seeds a project with a row in every table and
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

### Commands and ports of the core — `core/commands/`, `core/ports/__tests__/fakes/`
Every operation is a command in a `CommandRegistry` (the IPC handlers are generated from it by
`electron/ipc/exposeCommandsOverIpc.ts`). Test a command without Electron:
```ts
const commands = new CommandRegistry();
registerScreeningCommands(commands, new DatabaseAdapter(':memory:'));
await commands.run(IpcChannel.SCREENING_LABELS_LIST, projectId);
```
`buildLibraryCommands(db, { paths: appPathsIn(tempDir), runtime: new FakeAppRuntime(), env: {} })` builds all
of them over a real library. Port doubles: `FakeSecretStore` (reversible "encryption" for API keys),
`FakeAppRuntime` (`restarts` counter, fixed version) and, on the Electron side,
`electron/ports/__tests__/fakes/FakeFilePicker.ts` (the person answering a file dialog) and `FakeNativeDialogs`.
`core/` must not import or mock `electron`: ESLint refuses it.

## Adding a new double
Name it `Fake<Thing>`, put it in the nearest `__tests__/fakes/`, give it a docstring with a usage example, and
make it implement the real interface so TypeScript catches drift.
