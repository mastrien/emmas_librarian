// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkValue } from '../checkValue';

describe('checkValue, how it reads what was given', () => {
  it('shortens a long value in the message to 60 characters and says it is a list', () => {
    const [problem] = checkValue(
      Array.from({ length: 40 }, (_, i) => i),
      { type: 'number' },
      'ids',
    );
    expect(problem.given.endsWith('... (lista)')).toBe(true);
    expect(problem.given.length).toBeLessThan(80);
  });

  it('says null when the value is null, and ausente when it is missing', () => {
    expect(checkValue(null, { type: 'string' }, 'name')[0].given).toBe('null (null)');
    expect(checkValue(undefined, { type: 'string' }, 'name')[0].given).toBe('ausente');
  });

  it('accepts a constant and an enum value, and refuses the others naming what was expected', () => {
    expect(checkValue(1, { const: 1 }, 'x')).toEqual([]);
    expect(checkValue(2, { const: 1 }, 'x')[0].expected).toBe('1');
    expect(checkValue('a', { enum: ['a'] }, 'x')).toEqual([]);
  });

  it('checks an object with no declared fields as any object, and refuses what is not an object', () => {
    expect(checkValue({ any: 1 }, { type: 'object' }, 'x')).toEqual([]);
    expect(checkValue([1], { type: 'object' }, 'x')).toHaveLength(1);
  });

  it('checks each item of a list against its schema, with the position in the path', () => {
    const problems = checkValue([1, 'a'], { type: 'array', items: { type: 'number' } }, 'ids');
    expect(problems.map((p) => p.path)).toEqual(['ids[1]']);
  });

  it('accepts a list with no item schema, and refuses what is not a list', () => {
    expect(checkValue([1, 'a'], { type: 'array' }, 'x')).toEqual([]);
    expect(checkValue('a', { type: 'array' }, 'x')).toHaveLength(1);
  });

  it('refuses a type it does not know how to check, instead of letting it through', () => {
    expect(checkValue(1, { type: 'integer' as never }, 'x')).toHaveLength(1);
  });

  it('names the missing and the stray fields of an object, and lets extra ones through when the schema allows', () => {
    const schema = {
      type: 'object' as const,
      properties: { id: { type: 'number' as const } },
      required: ['id'],
    };
    const [missing, stray] = checkValue({ other: 1 }, schema, 'p');
    expect(missing).toMatchObject({ path: 'p.id', given: 'ausente' });
    expect(stray).toMatchObject({ path: 'p.other', expected: 'um destes campos: id' });
    expect(checkValue({ id: 1, other: 1 }, { ...schema, additionalProperties: {} }, 'p')).toEqual([]);
  });
});
