import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { registerScreeningOrderCommands } from '../screeningOrderCommands';
import { IpcChannel } from '../../../src/types';
import type { ScreeningRank } from '../../../src/types/screeningOrder';
import { CommandRegistry } from '../CommandRegistry';

describe('screening order IPC handlers (#55)', () => {
  let commands: CommandRegistry;
  let db: DatabaseAdapter;
  let projectId: number;

  beforeEach(() => {
    commands = new CommandRegistry();
    db = new DatabaseAdapter(':memory:');
    projectId = db.createProject('Revisão').id;
    const embedder = {
      embedBatch: async (texts: string[]) => texts.map((text) => (text.startsWith('Sim') ? [1, 0] : [0, 1])),
    };
    registerScreeningOrderCommands(commands, db, () => ({ embedder, modelId: 'ollama/x' }));
  });

  const add = (title: string) =>
    Number(
      db.getDB().prepare('INSERT INTO articles (project_id, title) VALUES (?, ?)').run(projectId, title)
        .lastInsertRowid,
    );

  const labelOf = (kind: string) => db.screeningLabelRepo.listLabels(projectId).find((l) => l.kind === kind)!.id;

  it('remembers the choice of the project', async () => {
    expect(await commands.run(IpcChannel.SCREENING_ORDER_GET, projectId)).toBe(false);

    await commands.run(IpcChannel.SCREENING_ORDER_SET, projectId, true);

    expect(await commands.run(IpcChannel.SCREENING_ORDER_GET, projectId)).toBe(true);
  });

  it('plans, generates, and ranks by the title-and-abstract decisions only', async () => {
    const yes = [add('Sim 1'), add('Sim 2'), add('Sim 3')];
    const no = [add('Não 1'), add('Não 2'), add('Não 3')];
    const unlikely = add('Não 4');
    const likely = add('Sim 4');
    expect(await commands.run(IpcChannel.SCREENING_VECTORS_PLAN, projectId)).toMatchObject({ pending: 8 });
    expect(await commands.run(IpcChannel.SCREENING_VECTORS_GENERATE, projectId)).toEqual({ generated: 8, pending: 0 });
    db.screeningDecisionRepo.decide(yes, labelOf('include'), 'title');
    db.screeningDecisionRepo.decide(no, labelOf('exclude'), 'title');
    db.screeningDecisionRepo.decide([likely], labelOf('exclude'), 'full');

    const rank = (await commands.run(IpcChannel.SCREENING_RANK, projectId)) as ScreeningRank;

    expect(rank.order).toEqual([likely, unlikely]);
    expect(rank.learnedFrom).toBe(6);
  });

  it('measures the classifier on what was decided, as an engine of its own', async () => {
    const yes = Array.from({ length: 6 }, (_, i) => add(`Sim ${i}`));
    const no = Array.from({ length: 6 }, (_, i) => add(`Não ${i}`));
    await commands.run(IpcChannel.SCREENING_VECTORS_GENERATE, projectId);
    db.screeningDecisionRepo.decide(yes, labelOf('include'), 'title');
    db.screeningDecisionRepo.decide(no, labelOf('exclude'), 'title');

    const saved = (await commands.run(IpcChannel.SCREENING_EVALUATE_CLASSIFIER, projectId)) as { engine: string }[];

    expect(saved).toHaveLength(12);
    expect(saved[0].engine).toBe('classificador-local/ollama/x');
  });

  it('simulates what was decided', async () => {
    const id = add('Sim 1');
    await commands.run(IpcChannel.SCREENING_VECTORS_GENERATE, projectId);
    db.screeningDecisionRepo.decide([id], labelOf('include'), 'title');

    expect(await commands.run(IpcChannel.SCREENING_SIMULATE, projectId)).toEqual({
      articles: 1,
      relevant: 1,
      predicted: [1],
      original: [1],
      withoutVector: 0,
    });
  });
});
