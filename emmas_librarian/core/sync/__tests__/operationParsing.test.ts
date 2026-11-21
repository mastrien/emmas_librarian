import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { parseOperation } from '../operationParsing';
import { parseSyncRequest } from '../syncProtocol';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
const db = new Database(':memory:');
db.exec(SCHEMA);

const valid = {
  opId: 'o',
  deviceId: 'd',
  entity: 'projects',
  uuid: 'u',
  kind: 'insert',
  fields: { name: 'x' },
  changedAt: 't',
};

describe('parseOperation', () => {
  it('accepts a well-formed operation', () => {
    expect(parseOperation(db, valid)).toMatchObject({ entity: 'projects', kind: 'insert', fields: { name: 'x' } });
  });

  it('refuses a value that is not an object, showing it', () => {
    expect(() => parseOperation(db, 'drop table')).toThrow('Operation must be an object, got "drop table"');
  });

  it('refuses an empty or missing text field, naming the field', () => {
    expect(() => parseOperation(db, { ...valid, opId: '' })).toThrow('"opId" must be a non-empty string, got ""');
  });

  it('refuses an insert without fields', () => {
    expect(() => parseOperation(db, { ...valid, fields: null })).toThrow('needs a fields object');
  });

  it('refuses a column value that is not a string, number or null', () => {
    expect(() => parseOperation(db, { ...valid, fields: { name: { nested: true } } })).toThrow(
      '"name" must be a string, number or null',
    );
  });

  it('accepts a delete without fields', () => {
    expect(parseOperation(db, { ...valid, kind: 'delete', fields: null }).fields).toBeNull();
  });
});

describe('parseSyncRequest', () => {
  it('refuses a request that is not an object', () => {
    expect(() => parseSyncRequest(null)).toThrow('Sync request must be an object, got null');
  });

  it('refuses operations that are not an array', () => {
    expect(() => parseSyncRequest({ cursor: 0, operations: 'x', processed: [] })).toThrow(
      '"operations" must be an array',
    );
  });

  it('refuses processed ids that are not strings', () => {
    expect(() => parseSyncRequest({ cursor: 0, operations: [], processed: [1] })).toThrow(
      '"processed" must be an array of operation ids',
    );
  });
});
