import { describe, it, expect } from 'vitest';
import { checkValue } from '../checkValue';
import type { ValueSchema } from '../valueSchema';

const paths = (value: unknown, schema: ValueSchema) => checkValue(value, schema, 'x').map((each) => each.path);

describe('checkValue', () => {
  it.each<[string, unknown, ValueSchema]>([
    ['a number', 3, { type: 'number' }],
    ['a string', 'Tese', { type: 'string' }],
    ['a boolean', false, { type: 'boolean' }],
    ['null where null is allowed', null, { anyOf: [{ type: 'null' }, { type: 'string' }] }],
    ['a member of an enum', 'full', { enum: ['title', 'full'] }],
    ['a list of numbers', [1, 2], { type: 'array', items: { type: 'number' } }],
    ['anything where the type is not known', { a: [1] }, { 'x-ts': 'unknown' }],
  ])('accepts %s', (_label, value, schema) => {
    expect(checkValue(value, schema, 'x')).toEqual([]);
  });

  // Regression of the CLI, which answered ok:true with [] to `articles:getByProject abc`.
  it('does not take the text "3" for the number 3', () => {
    expect(checkValue('3', { type: 'number' }, 'projectId')).toEqual([
      { path: 'projectId', given: '"3" (string)', expected: 'número' },
    ]);
  });

  it.each<[string, unknown, ValueSchema]>([
    ['an enum value that is not listed', 'abstract', { enum: ['title', 'full'] }],
    ['a number in a list of texts', ['a', 1], { type: 'array', items: { type: 'string' } }],
    ['NaN', Number.NaN, { type: 'number' }],
    ['a list where an object is wanted', [], { type: 'object', properties: {} }],
    ['null where null is not allowed', null, { type: 'string' }],
  ])('refuses %s', (_label, value, schema) => {
    expect(checkValue(value, schema, 'x')).not.toEqual([]);
  });

  it('points at the element of a list that does not fit', () => {
    expect(paths(['a', 1, 'c'], { type: 'array', items: { type: 'string' } })).toEqual(['x[1]']);
  });

  describe('objects', () => {
    const schema: ValueSchema = {
      type: 'object',
      properties: { id: { type: 'number' }, name: { type: 'string' } },
      required: ['id'],
    };

    it('accepts the declared fields, with the optional one left out', () => {
      expect(checkValue({ id: 1 }, schema, 'x')).toEqual([]);
    });

    it('lists a missing required field, a wrong one and a stray one together', () => {
      expect(paths({ name: 5, nome: 'typo' }, schema).sort()).toEqual(['x.id', 'x.name', 'x.nome']);
    });

    it('accepts any key where the object is a map', () => {
      const map: ValueSchema = { type: 'object', properties: {}, additionalProperties: { type: 'number' } };

      expect(checkValue({ a: 1, b: 2 }, map, 'x')).toEqual([]);
    });
  });
});
