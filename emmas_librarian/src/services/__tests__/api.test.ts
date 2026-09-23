import { describe, it, expect, beforeEach } from 'vitest';
import { projectService as api } from '../api';
import { IpcChannel } from '../../types';
import { FrontendAppError } from '../../utils/AppError';
import { FakeElectronApi } from './fakes/FakeElectronApi';

let bridge: FakeElectronApi;

beforeEach(() => {
  bridge = FakeElectronApi.install();
});

function serializedAppError(code: string, message: string): Error {
  const payload = { isAppError: true, code, type: 'USER_ERROR', message, details: { field: 'name' } };
  return new Error(`Error invoking remote method: Error: ${JSON.stringify(payload)}`);
}

describe('safeInvoke error translation', () => {
  it('rehydrates a serialized main-process AppError into a FrontendAppError', async () => {
    bridge.failWith(IpcChannel.PROJECTS_CREATE, serializedAppError('ERR_DUPLICATE', 'Nome já existe'));

    const error = await api.createProject('P').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FrontendAppError);
    expect(error).toMatchObject({ code: 'ERR_DUPLICATE', type: 'USER_ERROR', message: 'Nome já existe' });
    expect((error as FrontendAppError).details).toEqual({ field: 'name' });
  });

  it('rethrows non-AppError failures unchanged', async () => {
    const raw = new Error('socket hang up');
    bridge.failWith(IpcChannel.PROJECTS_GET_ALL, raw);

    await expect(api.getProjects()).rejects.toBe(raw);
  });

  it('replaces an empty rejection with a generic error', async () => {
    bridge.failWith(IpcChannel.PROJECTS_GET_ALL, undefined);

    await expect(api.getProjects()).rejects.toThrow('Unknown error');
  });
});

describe('getHighlights', () => {
  it('converts DB rows into renderer highlights', async () => {
    const position = { boundingRect: { x1: 1 }, rects: [], pageNumber: 3 };
    const row = { id: 7, article_id: 2, color: 'yellow', position_data: JSON.stringify(position) };
    bridge.respondWith(IpcChannel.HIGHLIGHTS_GET, [{ ...row, content_text: 't', annotation_id: 9, comment: 'c' }]);

    const [highlight] = await api.getHighlights(2);

    expect(highlight).toEqual({
      id: '7',
      article_id: 2,
      color: 'yellow',
      position_data: position,
      content_text: 't',
      annotation_id: 9,
      comment: 'c',
    });
  });
});

describe('createHighlight', () => {
  it('serializes position data and reports a pending annotation when content is given', async () => {
    bridge.respondWith(IpcChannel.HIGHLIGHTS_CREATE, 42);

    const result = await api.createHighlight(2, 'red', { pageNumber: 1 }, 'text', 'note');

    expect(result).toEqual({ id: 42, annotation_id: -1 });
    expect(bridge.lastInvocation()?.args).toEqual([2, 'red', '{"pageNumber":1}', 'text', 'note']);
  });

  it('reports no annotation when none is given', async () => {
    bridge.respondWith(IpcChannel.HIGHLIGHTS_CREATE, 43);

    expect(await api.createHighlight(2, 'red', {}, null)).toEqual({ id: 43, annotation_id: null });
  });
});

describe('createAnnotation', () => {
  it('wraps the new id', async () => {
    bridge.respondWith(IpcChannel.ANNOTATIONS_CREATE, 11);

    expect(await api.createAnnotation(2, 'c')).toEqual({ id: 11 });
    expect(bridge.lastInvocation()?.args).toEqual([2, 'c']);
  });
});

describe('project documents keep positional args', () => {
  it('createProjectDocument sends null for omitted optionals', async () => {
    bridge.respondWith(IpcChannel.PROJECT_DOCUMENTS_CREATE, 5);

    expect(await api.createProjectDocument(1, 'Doc')).toBe(5);
    expect(bridge.lastInvocation()?.args).toEqual([1, 'Doc', null, null, null]);
  });

  it('createProjectDocument forwards provided optionals', async () => {
    await api.createProjectDocument(1, 'Doc', 'http://u', '/f', 'ref');

    expect(bridge.lastInvocation()?.args).toEqual([1, 'Doc', 'http://u', '/f', 'ref']);
  });

  it('updateProjectDocument sends null for omitted optionals', async () => {
    await api.updateProjectDocument(3, 'Doc');

    expect(bridge.lastInvocation()).toEqual({ channel: IpcChannel.PROJECT_DOCUMENTS_UPDATE, args: [3, 'Doc', null, null, null] });
  });

  it('updateProjectDocument forwards provided optionals', async () => {
    await api.updateProjectDocument(3, 'Doc', 'http://u', '/f', 'ref');

    expect(bridge.lastInvocation()?.args).toEqual([3, 'Doc', 'http://u', '/f', 'ref']);
  });
});

describe('question sets normalize a missing project id to null', () => {
  const missing = undefined as unknown as null;

  it('getQuestionSets', async () => {
    await api.getQuestionSets(missing);

    expect(bridge.lastInvocation()?.args).toEqual([null]);
  });

  it('duplicateQuestionSet', async () => {
    await api.duplicateQuestionSet(6, missing);

    expect(bridge.lastInvocation()?.args).toEqual([6, null]);
  });
});

describe('agenda handlers take a single payload object', () => {
  const venue = { title: 'X', category: 'journal' as const, milestones: [] };

  it('updateScientificVenue', async () => {
    bridge.respondWith(IpcChannel.SCIENTIFIC_VENUE_UPDATE, { id: 3 });

    expect(await api.updateScientificVenue(3, venue)).toEqual({ id: 3 });
    expect(bridge.lastInvocation()?.args).toEqual([{ id: 3, venueData: venue }]);
  });

  it('toggleMilestoneStatus', async () => {
    bridge.respondWith(IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS, true);

    expect(await api.toggleMilestoneStatus(9, 'completed')).toBe(true);
    expect(bridge.lastInvocation()).toEqual({
      channel: IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS,
      args: [{ milestoneId: 9, status: 'completed' }],
    });
  });
});
