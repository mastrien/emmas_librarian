// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ts from 'typescript';
import type { CommandSchema } from '../../../core/harness/commandSchema';
import { extractCommandSchemas } from '../extractCommandSchemas';

// A stand-in with the same name as the real registry: the extractor recognises it by that name.
const FIXTURE = `
class CommandRegistry { add(name: string, run: (...args: never[]) => unknown): void { void name; void run; } }
type Base = 'wos' | 'scopus';
interface Limits { common: number; perBase: Partial<Record<Base, number>>; }
enum Channel { SEARCH = 'search:preview', DIARY_SAVE = 'diary:save', TRASH_RESTORE = 'trash:restore', SCREEN = 'screening:decide', VENUE = 'venue:update', LOOP = 'tree:walk' }
type TrashType = 'project' | 'article';
interface Node { label: string; children?: Node[]; }
const commands = new CommandRegistry();

// Saves one diary entry; \`expected\` guards against overwriting a newer one.
commands.add(Channel.DIARY_SAVE, (projectId: number, date: string, content: string, expected?: string | null) => 0);
commands.add(Channel.TRASH_RESTORE, (type: TrashType, id: number) => 0);
commands.add(Channel.SCREEN, (articleIds: number[], stage: 'title' | 'full', flag = false) => 0);
commands.add(Channel.VENUE, ({ id, data }: { id: number; data: { name: string; year?: number } }) => 0);
commands.add(Channel.LOOP, (root: Node) => 0);
commands.add(Channel.SEARCH, (limits: Limits, replaceIndex = false, label = 'x', n = 3) => 0);
commands.add('free:text', (anything: unknown, fn: () => void) => 0);
`;

let folder: string;
let commands: Record<string, CommandSchema>;

beforeAll(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-extract-'));
  const file = path.join(folder, 'commands.ts');
  fs.writeFileSync(file, FIXTURE);
  const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022, noEmit: true, types: [] };
  const found = extractCommandSchemas({ root: folder, files: [file], options });
  commands = Object.fromEntries(found.map((command) => [command.name, command]));
}, 60_000);

afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

const schemaOf = (command: string, parameter: number) => commands[command].parameters[parameter].schema;

describe('extractCommandSchemas', () => {
  it('finds every command, naming an enum member by its value', () => {
    expect(Object.keys(commands).sort()).toEqual([
      'diary:save',
      'free:text',
      'screening:decide',
      'search:preview',
      'trash:restore',
      'tree:walk',
      'venue:update',
    ]);
  });

  it('reads the names, the types and which arguments are optional', () => {
    expect(commands['diary:save'].parameters).toEqual([
      { name: 'projectId', required: true, schema: { type: 'number' } },
      { name: 'date', required: true, schema: { type: 'string' } },
      { name: 'content', required: true, schema: { type: 'string' } },
      { name: 'expected', required: false, schema: { anyOf: [{ type: 'null' }, { type: 'string' }] } },
    ]);
  });

  it('turns a union of literals, also through a type alias, into an enum', () => {
    expect(schemaOf('trash:restore', 0)).toEqual({ enum: ['project', 'article'] });
    expect(schemaOf('screening:decide', 1)).toEqual({ enum: ['title', 'full'] });
  });

  it('reads lists, and a default value as an optional argument', () => {
    expect(schemaOf('screening:decide', 0)).toEqual({ type: 'array', items: { type: 'number' } });
    expect(commands['screening:decide'].parameters[2]).toMatchObject({ required: false, schema: { type: 'boolean' } });
  });

  // Regression: inside commands.add the contextual type of an unannotated parameter is never, so
  // replaceIndex = false came out as an object that accepts nothing.
  it('takes the type of an unannotated argument from its default value', () => {
    expect(commands['search:preview'].parameters.slice(1)).toEqual([
      { name: 'replaceIndex', required: false, schema: { type: 'boolean' } },
      { name: 'label', required: false, schema: { type: 'string' } },
      { name: 'n', required: false, schema: { type: 'number' } },
    ]);
  });

  // Regression: the fields of Partial<Record<K, V>> have no declaration and were left out, so perBase accepted no key.
  it('reads the fields of a mapped type', () => {
    expect(schemaOf('search:preview', 0)).toEqual({
      type: 'object',
      properties: {
        common: { type: 'number' },
        perBase: { type: 'object', properties: { wos: { type: 'number' }, scopus: { type: 'number' } } },
      },
      required: ['common', 'perBase'],
    });
  });

  it('describes an object taken apart in the signature as the object it is', () => {
    expect(commands['venue:update'].parameters[0]).toEqual({
      name: '{ id, data }',
      required: true,
      schema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          data: {
            type: 'object',
            properties: { name: { type: 'string' }, year: { type: 'number' } },
            required: ['name'],
          },
        },
        required: ['id', 'data'],
      },
    });
  });

  it('stops at a type that contains itself and says which type it was', () => {
    const children = (schemaOf('tree:walk', 0).properties as Record<string, { items?: unknown }>).children;

    expect(JSON.stringify(children)).toContain('"x-ts":"Node"');
  });

  it('accepts anything where the type says nothing, and keeps the type it could not express', () => {
    expect(schemaOf('free:text', 0)).toEqual({ 'x-ts': 'unknown' });
    expect(schemaOf('free:text', 1)).toEqual({ 'x-ts': '() => void' });
  });

  it('keeps the comment above a command as its description, and the place it is registered', () => {
    expect(commands['diary:save'].description).toBe(
      'Saves one diary entry; `expected` guards against overwriting a newer one.',
    );
    expect(commands['diary:save'].source).toMatch(/commands\.ts:\d+$/);
    expect(commands['trash:restore'].description).toBeUndefined();
  });
});
