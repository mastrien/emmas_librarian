import { describe, it, expect } from 'vitest';
import { bindArguments, describeArguments } from '../bindArguments';
import type { CommandSchema } from '../commandSchema';

const diarySave: CommandSchema = {
  name: 'diary:save',
  source: 'test',
  parameters: [
    { name: 'projectId', required: true, schema: { type: 'number' } },
    { name: 'date', required: true, schema: { type: 'string' } },
    { name: 'content', required: true, schema: { type: 'string' } },
    { name: 'expected', required: false, schema: { anyOf: [{ type: 'null' }, { type: 'string' }] } },
  ],
};

const refusal = (command: CommandSchema, input: unknown): { code: string; message: string } => {
  try {
    bindArguments(command, input);
  } catch (error) {
    return error as { code: string; message: string };
  }
  throw new Error('expected the call to be refused');
};

describe('bindArguments', () => {
  it('orders the arguments as the command takes them, whatever order the model wrote them in', () => {
    const input = { content: 'Li dois artigos.', projectId: 3, date: '2026-11-14' };

    expect(bindArguments(diarySave, input)).toEqual([3, '2026-11-14', 'Li dois artigos.']);
  });

  it('leaves out the trailing optional argument that was not given, and keeps one that was', () => {
    expect(bindArguments(diarySave, { projectId: 1, date: 'd', content: 'c' })).toHaveLength(3);
    expect(bindArguments(diarySave, { projectId: 1, date: 'd', content: 'c', expected: null })).toHaveLength(4);
  });

  it('takes an object taken apart in the handler as the argument `input`', () => {
    const venue: CommandSchema = {
      name: 'scientificVenue:update',
      source: 'test',
      parameters: [
        {
          name: '{ id, venueData }',
          required: true,
          schema: { type: 'object', properties: { id: { type: 'number' } } },
        },
      ],
    };

    expect(bindArguments(venue, { input: { id: 2 } })).toEqual([{ id: 2 }]);
  });

  describe('a call that is wrong', () => {
    it('names the value and what was expected, as the CLI errors do', () => {
      const failure = refusal(diarySave, { projectId: 'abc', date: '2026-11-14', content: 'c' });

      expect(failure.code).toBe('ERR_INVALID_ARGUMENTS');
      expect(failure.message).toContain('Argumentos inválidos para "diary:save"');
      expect(failure.message).toContain('Offending value: projectId = "abc" (string), esperado número');
      expect(failure.message).toContain(
        'Expected shape: projectId: número; date: texto; content: texto; expected?: null | texto',
      );
    });

    it('reports everything wrong at once, so one retry can fix it', () => {
      const failure = refusal(diarySave, { projectId: 'x', conteudo: 'typo' });

      expect(failure.message).toContain('conteudo');
      expect(failure.message).toContain('projectId = "x"');
      expect(failure.message).toContain('date = ausente');
      expect(failure.message).toContain('content = ausente');
    });

    it.each([[null], ['3'], [[1, 2]], [undefined]])('refuses %j where an object is expected', (input) => {
      expect(refusal(diarySave, input).message).toContain('em vez de um objeto');
    });
  });

  it('describes a command that takes nothing', () => {
    expect(describeArguments({ name: 'trash:empty', parameters: [], source: 'test' })).toBe('nenhum argumento');
  });
});
