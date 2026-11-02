import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { registerProjectQuestionHandlers } from '../handlers/projectQuestionHandlers';
import { IpcChannel } from '../../types';
import type { AIService } from '../../services/AIService';
import { FakeIpcMain } from './fakes/FakeIpcMain';

vi.mock('electron', () => ({ safeStorage: {}, app: { isPackaged: false } }));

/** Records what reached the AI service, which has its own tests. */
class FakeProjectQuestions {
  projectIndexCoverage = vi.fn((articleIds: number[]) => ({ total: articleIds.length }));
  askProject = vi.fn(async (question: string, articleIds: number[]) => ({ question, articleIds }));
}

describe('project question IPC handlers (#53)', () => {
  let ipc: FakeIpcMain;
  let ai: FakeProjectQuestions;
  let projectId: number;
  let articleId: number;

  beforeEach(() => {
    ipc = new FakeIpcMain();
    ai = new FakeProjectQuestions();
    const db = new DatabaseAdapter(':memory:');
    projectId = db.createProject('Revisão').id;
    const insert = db.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (?, 'A')");
    articleId = Number(insert.run(projectId).lastInsertRowid);
    registerProjectQuestionHandlers(ipc, db, ai as unknown as AIService);
  });

  it('reports the coverage of the articles of the project', async () => {
    expect(await ipc.invoke(IpcChannel.AI_PROJECT_INDEX_COVERAGE, projectId)).toEqual({ total: 1 });
    expect(ai.projectIndexCoverage).toHaveBeenCalledWith([articleId]);
  });

  it('asks over the articles of the project', async () => {
    expect(await ipc.invoke(IpcChannel.AI_ASK_PROJECT, projectId, 'Qual a amostra?')).toEqual({
      question: 'Qual a amostra?',
      articleIds: [articleId],
    });
  });
});
