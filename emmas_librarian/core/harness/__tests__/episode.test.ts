// A scripted episode, the way a model would drive the library: tool names, JSON inputs, results read back.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { commandSchemas } from '../commandSchemas';
import { LibraryToolkit, type ToolResult } from '../LibraryToolkit';
import { TrajectoryLog } from '../trajectory';
import { MemorySink } from './support/MemorySink';
import { openTestLibrary, type TestLibrary } from './support/openTestLibrary';

let library: TestLibrary;
let sink: MemorySink;
let toolkit: LibraryToolkit;

beforeEach(() => {
  library = openTestLibrary();
  sink = new MemorySink();
  toolkit = new LibraryToolkit({
    commands: library.commands,
    schemas: commandSchemas(),
    log: new TrajectoryLog(sink),
  });
});

afterEach(() => {
  library.close();
});

const resultOf = (answer: ToolResult): unknown => {
  if (!answer.ok) throw new Error(`the call failed: ${answer.error.message}`);
  return answer.result;
};

describe('an episode against a real library', () => {
  it('creates a project, writes in its diary and reads it back', async () => {
    const created = resultOf(await toolkit.call('projects__create', { name: 'Revisão sobre tutoria' })) as {
      id: number;
    };
    await toolkit.call('diary__save', { projectId: created.id, date: '2026-11-14', content: 'Li dois artigos.' });
    const entries = resultOf(await toolkit.call('diary__getAll', { projectId: created.id })) as Array<{
      content: string;
    }>;

    expect(entries.map((entry) => entry.content)).toEqual(['Li dois artigos.']);
  });

  it('lets a model correct a wrong call from the error it was given', async () => {
    const created = resultOf(await toolkit.call('projects__create', { name: 'Revisão' })) as { id: number };

    const first = await toolkit.call('articles__getByProject', { projectId: String(created.id) });
    const retry = await toolkit.call('articles__getByProject', { projectId: created.id });

    expect(first).toMatchObject({ ok: false, error: { code: 'ERR_INVALID_ARGUMENTS' } });
    expect(first.ok === false && first.error.message).toContain('esperado número');
    expect(retry).toEqual({ ok: true, result: [] });
  });

  it('answers what the library itself refuses with the library own code', async () => {
    await toolkit.call('projects__create', { name: 'Única' });

    const duplicate = await toolkit.call('projects__create', { name: 'Única' });

    expect(duplicate).toMatchObject({ ok: false, error: { code: 'ERR_DUPLICATE_NAME', type: 'USER_ERROR' } });
  });

  it('never hands over the API keys', async () => {
    expect(await toolkit.call('settings__get', { key: 'gemini_api_key' })).toMatchObject({
      ok: false,
      error: { code: 'ERR_UNKNOWN_TOOL' },
    });
  });

  it('leaves a trajectory of every call, in order, that can be read back as JSON lines', async () => {
    await toolkit.call('projects__getAll', {});
    await toolkit.call('projects__getOne', { projectId: 'x' });

    expect(sink.steps().map((step) => [step.step, step.tool, step.ok])).toEqual([
      [1, 'projects__getAll', true],
      [2, 'projects__getOne', false],
    ]);
  });
});
