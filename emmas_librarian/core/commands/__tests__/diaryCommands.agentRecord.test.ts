import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openTestLibrary, type TestLibrary } from '../../harness/__tests__/support/openTestLibrary';

const DAY = '2026-11-10';

describe('diary:appendAgentRecord over real SQLite', () => {
  let library: TestLibrary;
  let projectId: number;
  beforeEach(async () => {
    library = openTestLibrary();
    projectId = ((await library.commands.run('projects:create', 'Revisão')) as { id: number }).id;
  });
  afterEach(() => library.close());

  const page = async () =>
    ((await library.commands.run('diary:getOne', projectId, DAY)) as { content: string }).content;

  it('adds the record to the end of a page that already has text, and keeps the version before it', async () => {
    await library.commands.run('diary:save', projectId, DAY, 'Li dois artigos.');
    await library.commands.run('diary:appendAgentRecord', projectId, DAY, 'Comecei o capítulo 2.');
    expect(await page()).toMatch(
      /^Li dois artigos\.\n\n\*\*\d{4}-\d\d-\d\d \d\d:\d\d · registro do agente de IA\*\*\nComecei o capítulo 2\.$/,
    );
    const history = (await library.commands.run('diary:getHistory', projectId, DAY)) as { content: string }[];
    expect(history.map((h) => h.content)).toContain('Li dois artigos.');
  });

  it('creates the page when there is none', async () => {
    await library.commands.run('diary:appendAgentRecord', projectId, DAY, 'Primeiro registro.');
    expect(await page()).toMatch(/^\*\*.* · registro do agente de IA\*\*\nPrimeiro registro\.$/);
  });

  it('refuses an empty message and leaves the page alone', async () => {
    await library.commands.run('diary:save', projectId, DAY, 'Texto.');
    await expect(library.commands.run('diary:appendAgentRecord', projectId, DAY, '  ')).rejects.toThrow(
      /ERR_INVALID_ARGUMENTS/,
    );
    expect(await page()).toBe('Texto.');
  });
});
