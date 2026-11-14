import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { registerScreeningSuggestionCommands } from '../screeningSuggestionCommands';
import { IpcChannel } from '../../../src/types';
import type { ScreeningSuggestion } from '../../../src/types/screeningSuggestion';
import { CommandRegistry } from '../CommandRegistry';

describe('screening suggestion IPC handlers (#54)', () => {
  let commands: CommandRegistry;
  let db: DatabaseAdapter;
  let projectId: number;
  let articleId: number;
  let prompts: string[];

  beforeEach(() => {
    commands = new CommandRegistry();
    db = new DatabaseAdapter(':memory:');
    prompts = [];
    projectId = db.createProject('Revisão').id;
    const insert = db
      .getDB()
      .prepare(
        "INSERT INTO articles (project_id, title, abstract, year) VALUES (?, 'Artigo', 'um resumo qualquer', 2021)",
      );
    articleId = Number(insert.run(projectId).lastInsertRowid);
    const complete = async (prompt: string) => {
      prompts.push(prompt);
      return '{"label": 1, "reason": "r", "quote": "resumo"}';
    };
    registerScreeningSuggestionCommands(commands, db, () => ({ complete, modelId: 'gemini/x' }));
  });

  const saveCriteria = () =>
    commands.run(IpcChannel.SCREENING_CRITERIA_SAVE, projectId, { inclusion: 'adultos', exclusion: '' });

  it('saves and reads the criteria', async () => {
    await saveCriteria();

    expect(await commands.run(IpcChannel.SCREENING_CRITERIA_GET, projectId)).toEqual({
      inclusion: 'adultos',
      exclusion: '',
    });
  });

  it('suggests with the title and abstract of the article, then lists it', async () => {
    await saveCriteria();

    const suggestion = (await commands.run(IpcChannel.SCREENING_SUGGEST, articleId)) as ScreeningSuggestion;

    expect(prompts[0]).toContain('um resumo qualquer');
    expect(prompts[0]).toContain('Ano: 2021');
    expect(suggestion).toMatchObject({ engine: 'gemini/x', quote: 'resumo', quote_found: 1 });
    expect(await commands.run(IpcChannel.SCREENING_SUGGESTIONS_LIST, projectId)).toEqual([suggestion]);
  });

  it('never offers the duplicates label', async () => {
    await saveCriteria();
    const removed = db.screeningLabelRepo.listLabels(projectId).find((label) => label.kind === 'removed');

    await commands.run(IpcChannel.SCREENING_SUGGEST, articleId);

    expect(removed).toBeDefined();
    expect(prompts[0]).not.toContain(`${removed?.name} (`);
  });

  it('says whom the text is sent to', async () => {
    expect(await commands.run(IpcChannel.SCREENING_ENGINE)).toEqual({ id: 'gemini/x', provider: 'gemini' });
  });
});
