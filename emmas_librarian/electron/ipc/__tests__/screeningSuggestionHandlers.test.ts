import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../../core/database/DatabaseAdapter';
import { registerScreeningSuggestionHandlers } from '../handlers/screeningSuggestionHandlers';
import { IpcChannel } from '../../types';
import type { ScreeningSuggestion } from '../../../src/types/screeningSuggestion';
import { FakeIpcMain } from './fakes/FakeIpcMain';

vi.mock('electron', () => ({ safeStorage: {}, app: { isPackaged: false } }));

describe('screening suggestion IPC handlers (#54)', () => {
  let ipc: FakeIpcMain;
  let db: DatabaseAdapter;
  let projectId: number;
  let articleId: number;
  let prompts: string[];

  beforeEach(() => {
    ipc = new FakeIpcMain();
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
    registerScreeningSuggestionHandlers(ipc, db, () => ({ complete, modelId: 'gemini/x' }));
  });

  const saveCriteria = () =>
    ipc.invoke(IpcChannel.SCREENING_CRITERIA_SAVE, projectId, { inclusion: 'adultos', exclusion: '' });

  it('saves and reads the criteria', async () => {
    await saveCriteria();

    expect(await ipc.invoke(IpcChannel.SCREENING_CRITERIA_GET, projectId)).toEqual({
      inclusion: 'adultos',
      exclusion: '',
    });
  });

  it('suggests with the title and abstract of the article, then lists it', async () => {
    await saveCriteria();

    const suggestion = (await ipc.invoke(IpcChannel.SCREENING_SUGGEST, articleId)) as ScreeningSuggestion;

    expect(prompts[0]).toContain('um resumo qualquer');
    expect(prompts[0]).toContain('Ano: 2021');
    expect(suggestion).toMatchObject({ engine: 'gemini/x', quote: 'resumo', quote_found: 1 });
    expect(await ipc.invoke(IpcChannel.SCREENING_SUGGESTIONS_LIST, projectId)).toEqual([suggestion]);
  });

  it('never offers the duplicates label', async () => {
    await saveCriteria();
    const removed = db.screeningLabelRepo.listLabels(projectId).find((label) => label.kind === 'removed');

    await ipc.invoke(IpcChannel.SCREENING_SUGGEST, articleId);

    expect(removed).toBeDefined();
    expect(prompts[0]).not.toContain(`${removed?.name} (`);
  });

  it('says whom the text is sent to', async () => {
    expect(await ipc.invoke(IpcChannel.SCREENING_ENGINE)).toEqual({ id: 'gemini/x', provider: 'gemini' });
  });
});
