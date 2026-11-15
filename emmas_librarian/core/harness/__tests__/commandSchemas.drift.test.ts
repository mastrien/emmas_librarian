// The generated schemas against the library's real commands: they must say what the handlers take.
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { argumentKey } from '../bindArguments';
import { commandSchemas } from '../commandSchemas';
import { LibraryToolkit } from '../LibraryToolkit';
import { fromToolName, toToolName } from '../toolNames';
import { openTestLibrary, type TestLibrary } from './support/openTestLibrary';

let library: TestLibrary;

beforeAll(() => {
  library = openTestLibrary();
});

afterAll(() => {
  library.close();
});

describe('generated command schemas', () => {
  it('describe every registered command, and nothing that is not registered', () => {
    const described = commandSchemas()
      .map((schema) => schema.name)
      .sort();

    expect(described).toEqual(library.commands.names().sort());
  });

  // Fails when a handler changes and `npm run schemas:generate` was not run.
  it('name the arguments of each command as the handler does', () => {
    const different = commandSchemas()
      .filter((schema) => {
        const registered = library.commands.get(schema.name).parameters;
        return JSON.stringify(registered) !== JSON.stringify(schema.parameters.map((parameter) => parameter.name));
      })
      .map((schema) => schema.name);

    expect(different).toEqual([]);
  });

  it('give every command a tool name that tool APIs accept and that is not shared', () => {
    const names = commandSchemas().map((schema) => schema.name);
    const toolNames = names.map(toToolName);

    expect(new Set(toolNames).size).toBe(names.length);
    expect(toolNames.map(fromToolName)).toEqual(names);
  });

  it('never give two arguments of one command the same key', () => {
    const clashing = commandSchemas().filter((schema) => {
      const keys = schema.parameters.map(argumentKey);
      return new Set(keys).size !== keys.length;
    });

    expect(clashing.map((schema) => schema.name)).toEqual([]);
  });
});

describe('the tools offered for the real library', () => {
  const toolkit = () => new LibraryToolkit({ commands: library.commands, schemas: commandSchemas() });

  it('are most of the library, and keep back the keys, the network, the AI and the disk', () => {
    const offered = toolkit()
      .tools()
      .map((tool) => tool.name);
    const hidden = toolkit()
      .hidden()
      .map((each) => each.name);

    expect(offered.length).toBeGreaterThan(60);
    expect(offered).toContain('projects__getAll');
    expect(hidden).toEqual(
      expect.arrayContaining([
        'settings:get',
        'settings:set',
        'backup:restoreOverride',
        'ai:generateSummary',
        'search:preview',
        'export:csv',
        'diary:save',
        'annotations:create',
        'trash:empty',
      ]),
    );
    expect(offered).not.toContain('settings__get');
  });

  it('require only arguments they also describe', () => {
    const broken = toolkit()
      .tools()
      .filter((tool) => tool.input_schema.required.some((key) => !(key in tool.input_schema.properties)));

    expect(broken).toEqual([]);
  });
});
