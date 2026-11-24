import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { registerAiCommands } from '../aiCommands';
import { CommandRegistry } from '../CommandRegistry';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import fs from 'fs';
import path from 'path';
import { IpcChannel } from '../../../src/types';

const mockLoadablePath: string | null = null;
vi.mock('sqlite-vec', async (importOriginal) => {
  const original = await importOriginal<typeof import('sqlite-vec')>();
  return {
    ...original,
    getLoadablePath: () => mockLoadablePath || original.getLoadablePath(),
  };
});

// The suite was written against IPC handlers, which receive the event first; commands take only the arguments.
let commands: CommandRegistry;
const handlerOf =
  (channel: string) =>
  (_event: unknown, ...args: unknown[]) =>
    commands.run(channel, ...args);

describe('Question set commands over real SQLite', () => {
  let db: Database.Database;
  let dbAdapter: any; // We use any to bypass private fields for the test if needed

  beforeEach(() => {
    // Create an in-memory database
    db = new Database(':memory:');

    // Apply schema
    const schemaPath = path.join(__dirname, '../../../core/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    // Provide the db via a mock DatabaseAdapter structure expected by setupAiIpcHandlers
    dbAdapter = {
      getDB: () => db,
    };

    // Register the handlers with a fake aiService
    const mockAiService = {} as any;
    commands = new CommandRegistry();
    registerAiCommands(commands, dbAdapter as DatabaseAdapter, mockAiService, {});
  });

  afterEach(() => {
    if (db) db.close();
  });

  it('should complete a full CRUD flow for Question Sets via IPC handlers', async () => {
    const listHandler = handlerOf(IpcChannel.QUESTION_SETS_LIST);
    const createHandler = handlerOf(IpcChannel.QUESTION_SETS_CREATE);
    const getHandler = handlerOf(IpcChannel.QUESTION_SETS_GET);
    const updateHandler = handlerOf(IpcChannel.QUESTION_SETS_UPDATE);
    const deleteHandler = handlerOf(IpcChannel.QUESTION_SETS_DELETE);
    const duplicateHandler = handlerOf(IpcChannel.QUESTION_SETS_DUPLICATE);

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
