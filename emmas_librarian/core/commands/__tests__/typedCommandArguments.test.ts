import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openTestLibrary, type TestLibrary } from '../../harness/__tests__/support/openTestLibrary';

// Regression for #27: `options` and `questions` had no declared shape, so a model had to guess it.
describe('commands whose arguments used to be untyped, over real SQLite', () => {
  let library: TestLibrary;
  let projectId: number;
  beforeEach(async () => {
    library = openTestLibrary();
    const project = (await library.commands.run('projects:create', 'Revisão sobre tutoria')) as { id: number };
    projectId = project.id;
  });
  afterEach(() => library.close());

  it('creates an enum category from a list of { name } options', async () => {
    const id = await library.commands.run('categories:createProject', projectId, 'Metodologia', 'enum', [
      { name: 'Qualitativa' },
      { name: 'Mista' },
    ]);
    const categories = (await library.commands.run('categories:getProject', projectId)) as {
      id: number;
      parsedOptions?: { name: string }[];
    }[];
    expect(categories.find((c) => c.id === id)?.parsedOptions?.map((o) => o.name)).toEqual(['Qualitativa', 'Mista']);
  });

  it('stores a question list sent as an array in the JSON form the interface reads', async () => {
    const created = (await library.commands.run('questionSets:create', {
      project_id: null,
      name: 'Metodologia',
      questions: ['Qual o método?', 'Qual a amostra?'],
    })) as { id: number; questions: string };
    expect(JSON.parse(created.questions)).toEqual(['Qual o método?', 'Qual a amostra?']);
  });

  it('still accepts the JSON text the interface sends', async () => {
    const created = (await library.commands.run('questionSets:create', {
      project_id: null,
      name: 'Do app',
      questions: JSON.stringify(['Q1']),
    })) as { questions: string };
    expect(created.questions).toBe('["Q1"]');
  });

  it('refuses a question set whose questions are free text, naming the value', async () => {
    const attempt = library.commands.run('questionSets:create', {
      project_id: null,
      name: 'Ruim',
      questions: 'Qual o método? Qual a amostra?',
    });
    await expect(attempt).rejects.toThrow(/ERR_INVALID_QUESTIONS.*Qual o método\?/s);
  });

  it('updates the questions of a set from an array', async () => {
    const created = (await library.commands.run('questionSets:create', {
      project_id: null,
      name: 'Para editar',
      questions: ['A'],
    })) as { id: number };
    await library.commands.run('questionSets:update', created.id, { questions: ['A', 'B'] });
    const stored = (await library.commands.run('questionSets:get', created.id)) as { questions: string };
    expect(JSON.parse(stored.questions)).toEqual(['A', 'B']);
  });
});
