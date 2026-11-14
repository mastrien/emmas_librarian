const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, runAppUntilExit, getFirstWindow, createProject, navigateTo } = require('./helpers');

// #31: the app's own executable runs one command of the library without a window (`<app> cli <command>`).
// The spec owns the data folder, because the app and the CLI take turns on the same library.
test.describe('Command line interface', () => {
  test.setTimeout(180000);
  let root;
  let userDataDir;

  const cli = async (...cliArgs) => {
    const { code, stdout, stderr } = await runAppUntilExit({}, { userDataDir, cliArgs });
    // Chromium writes its own warnings to stderr; the CLI's document is the line that is JSON.
    const errorLine = stderr.split('\n').find((line) => line.startsWith('{"ok"'));
    return {
      code,
      stdout,
      output: stdout ? JSON.parse(stdout) : null,
      error: errorLine ? JSON.parse(errorLine).error : null,
    };
  };

  test.beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-cli-'));
    userDataDir = path.join(root, 'userData');
    fs.mkdirSync(userDataDir);
  });

  test.afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('F-19 the CLI reads and writes the library the app uses, answering JSON and exit codes', async () => {
    let app = await launchApp({}, { userDataDir });
    let window = await getFirstWindow(app);
    await createProject(window, 'Feito no app');

    // With the app open: reading works, replacing the database is refused.
    const whileOpen = await cli('projects:getAll');
    expect(whileOpen.code).toBe(0);
    expect(whileOpen.output.result.map((project) => project.name)).toEqual(['Feito no app']);
    const refused = await cli('backup:restoreAuto', 'emma_backup_2026-01-01.db.gz');
    expect(refused.code).toBe(5);
    expect(refused.error.code).toBe('ERR_LIBRARY_IN_USE');
    await app.close();

    // stdout is exactly one JSON document: nothing else the app logs may leak into it.
    const created = await cli('projects:create', 'Feito no CLI');
    expect(created.code).toBe(0);
    expect(created.stdout.trim().split('\n')).toHaveLength(1);
    expect(created.output).toMatchObject({ ok: true, result: { name: 'Feito no CLI' } });

    const target = path.join(root, 'artigos.csv');
    const exported = await cli('export:csv', String(created.output.result.id), target);
    expect(exported.output).toEqual({ ok: true, result: target });
    expect(fs.readFileSync(target, 'utf8')).toContain('title');

    const duplicate = await cli('projects:create', 'Feito no CLI');
    expect(duplicate.code).toBe(3);
    expect(duplicate.error.code).toBe('ERR_DUPLICATE_NAME');
    expect(duplicate.stdout).toBe('');
    expect((await cli('pdf:get', '1')).code).toBe(2);
    expect((await cli('projects:getAl')).error.code).toBe('ERR_UNKNOWN_COMMAND');

    // What the CLI wrote is there when the app opens again.
    app = await launchApp({}, { userDataDir });
    window = await getFirstWindow(app);
    await navigateTo(window, 'Projetos');
    await expect(window.getByText('Feito no CLI', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(window.getByText('Feito no app', { exact: true })).toBeVisible();
    await app.close();
  });
});
