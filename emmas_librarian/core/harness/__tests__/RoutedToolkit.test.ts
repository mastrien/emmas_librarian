// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { LibraryToolkit } from '../LibraryToolkit';
import { RoutedToolkit, SELECT_AREAS } from '../RoutedToolkit';
import { TOOL_AREAS, type ToolArea } from '../toolAreas';
import { TOOL_ACCESS, type Access } from '../toolAccess';
import { commandSchemas } from '../commandSchemas';
import { FakeConfirmer } from './support/FakeConfirmer';

const READ: Access = { confirm: false, localOnly: false };
const number = { type: 'number' as const };
const AREAS: ToolArea[] = [
  { id: 'projetos', about: 'projetos', commands: ['projects:getAll', 'projects:delete'] },
  { id: 'diario', about: 'diário', commands: ['diary:getOne'] },
  { id: 'vazia', about: 'sem ferramenta oferecida', commands: ['not:offered'] },
];

function build() {
  const deleted = vi.fn();
  const commands = new CommandRegistry();
  commands.add('projects:getAll', () => [{ id: 1 }]);
  commands.add('projects:delete', (id: number) => deleted(id));
  commands.add('diary:getOne', (id: number) => ({ id }));
  const toolkit = new LibraryToolkit({
    commands,
    confirmer: new FakeConfirmer(true),
    access: new Map([
      ['projects:getAll', READ],
      ['projects:delete', { confirm: true, localOnly: false }],
      ['diary:getOne', READ],
    ]),
    schemas: [
      { name: 'projects:getAll', parameters: [], source: 't' },
      { name: 'projects:delete', parameters: [{ name: 'id', required: true, schema: number }], source: 't' },
      { name: 'diary:getOne', parameters: [{ name: 'id', required: true, schema: number }], source: 't' },
    ],
  });
  return { routed: new RoutedToolkit(toolkit, AREAS), deleted };
}

const names = (routed: RoutedToolkit): string[] => routed.tools().map((tool) => tool.name);

describe('RoutedToolkit', () => {
  it('starts with only the tool that chooses subjects, listing the subjects that have tools', () => {
    const { routed } = build();
    expect(names(routed)).toEqual([SELECT_AREAS]);
    const selector = routed.tools()[0];
    expect(selector.description).toContain('- projetos: projetos');
    expect(selector.description).not.toContain('vazia');
    expect(selector.input_schema.properties.areas).toEqual({ type: 'array', items: { enum: ['projetos', 'diario'] } });
  });

  it('offers the tools of the chosen subjects, and adds subjects when asked again', async () => {
    const { routed } = build();
    expect(await routed.call(SELECT_AREAS, { areas: ['projetos'] })).toEqual({
      ok: true,
      result: { areas: ['projetos'], tools: ['projects__getAll', 'projects__delete'] },
    });
    await routed.call(SELECT_AREAS, { areas: ['diario'] });
    expect(names(routed)).toEqual([SELECT_AREAS, 'projects__getAll', 'projects__delete', 'diary__getOne']);
  });

  it('runs a tool of a chosen subject through the toolkit', async () => {
    const { routed } = build();
    await routed.call(SELECT_AREAS, { areas: ['projetos'] });
    expect(await routed.call('projects__getAll', {})).toEqual({ ok: true, result: [{ id: 1 }] });
  });

  // Regression of the first draft, which ran the tool before telling the model its subject was not chosen.
  it('does not run a tool of a subject not chosen yet, and says what to do', async () => {
    const { routed, deleted } = build();
    const answer = await routed.call('projects__delete', { id: 1 });

    expect(answer).toMatchObject({ ok: false, error: { code: 'ERR_AREA_NOT_SELECTED' } });
    expect(answer.ok === false && answer.error.message).toContain('{ "areas": ["projetos"] }');
    expect(deleted).not.toHaveBeenCalled();
  });

  it('answers a tool that exists nowhere as unknown', async () => {
    const { routed } = build();
    expect(await routed.call('made__up', {})).toMatchObject({ ok: false, error: { code: 'ERR_UNKNOWN_TOOL' } });
  });

  it.each([[{}], [{ areas: [] }], [{ areas: ['nada'] }], [{ areas: 'projetos' }], ['projetos']])(
    'refuses %j, naming the subjects',
    async (input) => {
      const { routed } = build();
      const answer = await routed.call(SELECT_AREAS, input);
      expect(answer).toMatchObject({ ok: false, error: { code: 'ERR_INVALID_ARGUMENTS' } });
      expect(answer.ok === false && answer.error.message).toContain('projetos, diario');
    },
  );
});

describe('TOOL_AREAS', () => {
  it('puts every command a model may use in exactly one subject, and nothing else', () => {
    const listed = TOOL_AREAS.flatMap((area) => area.commands);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...TOOL_ACCESS.keys()].sort());
  });

  it('keeps every subject small enough for a small model (at most 15 tools)', () => {
    expect(TOOL_AREAS.filter((area) => area.commands.length > 15).map((area) => area.id)).toEqual([]);
    expect(commandSchemas().length).toBeGreaterThan(0);
  });
});
