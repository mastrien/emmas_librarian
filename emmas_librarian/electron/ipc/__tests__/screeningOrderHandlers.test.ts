import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { registerScreeningOrderHandlers } from '../handlers/screeningOrderHandlers';
import { IpcChannel } from '../../types';
import type { ScreeningRank } from '../../../src/types/screeningOrder';
import { FakeIpcMain } from './fakes/FakeIpcMain';

vi.mock('electron', () => ({ safeStorage: {}, app: { isPackaged: false } }));

describe('screening order IPC handlers (#55)', () => {
  let ipc: FakeIpcMain;
  let db: DatabaseAdapter;
  let projectId: number;

  beforeEach(() => {
    ipc = new FakeIpcMain();
    db = new DatabaseAdapter(':memory:');
    projectId = db.createProject('Revisão').id;
    const embedder = {
      embedBatch: async (texts: string[]) => texts.map((text) => (text.startsWith('Sim') ? [1, 0] : [0, 1])),
    };
    registerScreeningOrderHandlers(ipc, db, () => ({ embedder, modelId: 'ollama/x' }));
  });

  const add = (title: string) =>
    Number(
      db.getDB().prepare('INSERT INTO articles (project_id, title) VALUES (?, ?)').run(projectId, title)
        .lastInsertRowid,
    );

  const labelOf = (kind: string) => db.screeningLabelRepo.listLabels(projectId).find((l) => l.kind === kind)!.id;

  it('remembers the choice of the project', async () => {
    expect(await ipc.invoke(IpcChannel.SCREENING_ORDER_GET, projectId)).toBe(false);

    await ipc.invoke(IpcChannel.SCREENING_ORDER_SET, projectId, true);

    expect(await ipc.invoke(IpcChannel.SCREENING_ORDER_GET, projectId)).toBe(true);
  });

  it('plans, generates, and ranks by the title-and-abstract decisions only', async () => {
    const yes = [add('Sim 1'), add('Sim 2'), add('Sim 3')];
    const no = [add('Não 1'), add('Não 2'), add('Não 3')];
    const unlikely = add('Não 4');
    const likely = add('Sim 4');
    expect(await ipc.invoke(IpcChannel.SCREENING_VECTORS_PLAN, projectId)).toMatchObject({ pending: 8 });
    expect(await ipc.invoke(IpcChannel.SCREENING_VECTORS_GENERATE, projectId)).toEqual({ generated: 8, pending: 0 });
    db.screeningDecisionRepo.decide(yes, labelOf('include'), 'title');
    db.screeningDecisionRepo.decide(no, labelOf('exclude'), 'title');
    db.screeningDecisionRepo.decide([likely], labelOf('exclude'), 'full');

    const rank = (await ipc.invoke(IpcChannel.SCREENING_RANK, projectId)) as ScreeningRank;

    expect(rank.order).toEqual([likely, unlikely]);
    expect(rank.learnedFrom).toBe(6);
  });

  it('simulates what was decided', async () => {
    const id = add('Sim 1');
    await ipc.invoke(IpcChannel.SCREENING_VECTORS_GENERATE, projectId);
    db.screeningDecisionRepo.decide([id], labelOf('include'), 'title');

    expect(await ipc.invoke(IpcChannel.SCREENING_SIMULATE, projectId)).toEqual({
      articles: 1,
      relevant: 1,
      predicted: [1],
      original: [1],
      withoutVector: 0,
    });
  });
});
