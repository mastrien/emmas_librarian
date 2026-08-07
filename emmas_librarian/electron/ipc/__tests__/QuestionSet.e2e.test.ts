import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { setupAiIpcHandlers } from '../aiIpcHandlers';
import { ProjectRepository } from '../../database/ProjectRepository';
import { ArticleRepository } from '../../database/ArticleRepository';
import { QuestionSetRepository } from '../../database/QuestionSetRepository';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';

let mockLoadablePath: string | null = null;
vi.mock('sqlite-vec', async (importOriginal) => {
  const original = await importOriginal<typeof import('sqlite-vec')>();
  return {
    ...original,
    getLoadablePath: () => mockLoadablePath || original.getLoadablePath(),
  };
});
import fs from 'fs';
import path from 'path';
import { IpcChannel } from '../../types';

// Mock the ipcMain so we can capture and call the registered handlers
const handlers: Record<string, Function> = {};
const mockIpcMain = {
  handle: (channel: string, callback: Function) => {
    handlers[channel] = callback;
  },
};

describe('QuestionSet E2E Integration', () => {
  let db: Database.Database;
  let dbAdapter: any; // We use any to bypass private fields for the test if needed

  beforeEach(() => {
    // Create an in-memory database
    db = new Database(':memory:');

    // Apply schema
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    // Provide the db via a mock DatabaseAdapter structure expected by setupAiIpcHandlers
    dbAdapter = {
      getDB: () => db,
    };

    // Register the handlers with a fake aiService
    const mockAiService = {} as any;
    setupAiIpcHandlers(dbAdapter as DatabaseAdapter, mockAiService, mockIpcMain as any);
  });

  afterEach(() => {
    if (db) db.close();
    // Clear handlers
    for (const key in handlers) delete handlers[key];
  });

  it('should complete a full CRUD flow for Question Sets via IPC handlers', async () => {
    const listHandler = handlers[IpcChannel.QUESTION_SETS_LIST];
    const createHandler = handlers[IpcChannel.QUESTION_SETS_CREATE];
    const getHandler = handlers[IpcChannel.QUESTION_SETS_GET];
    const updateHandler = handlers[IpcChannel.QUESTION_SETS_UPDATE];
    const deleteHandler = handlers[IpcChannel.QUESTION_SETS_DELETE];
    const duplicateHandler = handlers[IpcChannel.QUESTION_SETS_DUPLICATE];

    expect(listHandler).toBeDefined();
    expect(createHandler).toBeDefined();

    // 1. Initially, list is empty
    let sets = await listHandler({}, null); // Global sets
    expect(sets.length).toBe(0);

    // 2. Create a new global set
    const payload = {
      project_id: null,
      name: 'E2E Test Set',
      description: 'A test set',
      questions: JSON.stringify(['Q1', 'Q2']),
    };
    const newSet = await createHandler({}, payload);
    expect(typeof newSet).toBe('object');
    const setId = newSet.id;

    // 3. List again, should have 1 set
    sets = await listHandler({}, null);
    expect(sets.length).toBe(1);
    expect(sets[0].name).toBe('E2E Test Set');
    expect(JSON.parse(sets[0].questions)).toEqual(['Q1', 'Q2']);

    // 4. Update the set
    await updateHandler({}, setId, { name: 'Updated Set Name' });

    // 5. Get the specific set
    const updatedSet = await getHandler({}, setId);
    expect(updatedSet.name).toBe('Updated Set Name');

    // 6. Duplicate the set
    const duplicateId = await duplicateHandler({}, setId, null);
    const duplicateSet = await getHandler({}, duplicateId);
    expect(duplicateSet.name).toBe('Updated Set Name (Cópia)');
    expect(duplicateSet.project_id).toBe(null);

    // 7. Delete the original set
    await deleteHandler({}, setId);
    sets = await listHandler({}, null);
    expect(sets.length).toBe(1); // global list has 1 remaining (the copy)
  });
});
