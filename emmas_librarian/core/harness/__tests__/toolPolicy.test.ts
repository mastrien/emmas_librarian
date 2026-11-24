import { describe, it, expect } from 'vitest';
import { commandSchemas } from '../commandSchemas';
import { DEFAULT_EXCLUSIONS, NEEDS_LOCAL_MODEL, whyHidden } from '../toolPolicy';
import { TOOL_ACCESS, buildAccess } from '../toolAccess';

describe('DEFAULT_EXCLUSIONS', () => {
  // A rule about a command that was renamed would hide nothing and nobody would notice.
  it.each(DEFAULT_EXCLUSIONS.map((exclusion) => [String(exclusion.pattern), exclusion] as const))(
    'still matches a command of the library: %s',
    (_label, exclusion) => {
      expect(commandSchemas().some((command) => exclusion.pattern.test(command.name))).toBe(true);
    },
  );
});

describe('TOOL_ACCESS', () => {
  it('names only commands that exist, so a rename cannot leave a command quietly hidden', () => {
    const known = new Set(commandSchemas().map((command) => command.name));
    expect([...TOOL_ACCESS.keys()].filter((name) => !known.has(name))).toEqual([]);
  });

  it('refuses a command listed in two groups, naming it', () => {
    const asks = { confirm: true, localOnly: false };
    const free = { confirm: false, localOnly: false };
    expect(() =>
      buildAccess([
        ['projects:delete', asks],
        ['projects:delete', free],
      ]),
    ).toThrow(/ERR_DUPLICATE_ACCESS.*projects:delete/s);
  });

  // The review of 2026-11-15: everything that creates, edits or removes asks the person first.
  it.each([
    ['projects:create', true],
    ['projects:delete', true],
    ['diary:appendAgentRecord', true],
    ['projects:getAll', false],
    ['diary:getOne', false],
  ])('%s asks first: %s', (name, confirm) => {
    expect(TOOL_ACCESS.get(name)?.confirm).toBe(confirm);
  });

  it.each([
    'ai:generateSummary',
    'pdf:fetchOpenAccess',
    'search:preview',
    'screening:vectorsGenerate',
    'ask:indexMissing',
  ])('%s needs a local model', (name) => {
    expect(TOOL_ACCESS.get(name)?.localOnly).toBe(true);
  });

  it.each([
    'settings:get',
    'trash:empty',
    'trash:permanentDelete',
    'annotations:create',
    'diary:save',
    'search:revert',
  ])('does not offer %s at all', (name) => {
    expect(TOOL_ACCESS.has(name)).toBe(false);
  });
});

describe('whyHidden', () => {
  const command = { name: 'projects:getAll', handler: () => [] } as unknown as Parameters<
    typeof whyHidden
  >[0]['command'];
  const schema = { name: 'projects:getAll', parameters: [], source: 't' };
  const base = { command, schema, inTerminal: true, modelIsLocal: true };

  it('hides what a terminal cannot run, before looking at anything else', () => {
    expect(whyHidden({ ...base, inTerminal: false, access: { confirm: false, localOnly: false } })).toMatch(
      /desktop app/,
    );
  });

  it('hides a command nobody allowed, giving the reason of its rule when it has one', () => {
    expect(whyHidden({ ...base, access: undefined })).toEqual(expect.any(String));
    const keys = DEFAULT_EXCLUSIONS[0];
    const ruled = { ...command, name: keys.pattern.source.replace(/[^a-z:]/gi, '') } as typeof command;
    expect(whyHidden({ ...base, command: ruled, access: undefined })).toEqual(expect.any(String));
  });

  it('offers an allowed command that touches no file', () => {
    expect(whyHidden({ ...base, access: { confirm: false, localOnly: false } })).toBeUndefined();
  });

  it('hides a command that asks for a file path unless that parameter is hidden from the model', () => {
    const withPath = {
      ...schema,
      parameters: [{ name: 'filePath', required: true, schema: { type: 'string' as const } }],
    };
    const access = { confirm: false, localOnly: false };
    expect(whyHidden({ ...base, schema: withPath, access })).toMatch(/file at a path/);
    expect(
      whyHidden({ ...base, schema: withPath, access: { ...access, hideParameters: ['filePath'] } }),
    ).toBeUndefined();
  });

  it('offers a command that sends text to a third party only with a local model', () => {
    const access = { confirm: false, localOnly: true };
    expect(whyHidden({ ...base, access, modelIsLocal: false })).toBe(NEEDS_LOCAL_MODEL);
    expect(whyHidden({ ...base, access, modelIsLocal: true })).toBeUndefined();
  });
});
