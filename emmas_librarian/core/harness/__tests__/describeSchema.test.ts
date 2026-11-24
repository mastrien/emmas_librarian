// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeSchema } from '../describeSchema';

describe('describeSchema', () => {
  it('writes a constant and an enum as the values themselves', () => {
    expect(describeSchema({ const: 3 })).toBe('3');
    expect(describeSchema({ enum: ['title', 'full'] })).toBe('"title" | "full"');
  });

  it('joins the alternatives of an anyOf with a bar', () => {
    expect(describeSchema({ anyOf: [{ type: 'string' }, { type: 'number' }] })).toBe('texto | número');
  });

  it('says what a list holds, or any value when it does not say', () => {
    expect(describeSchema({ type: 'array', items: { type: 'number' } })).toBe('lista de número');
    expect(describeSchema({ type: 'array' })).toBe('lista de qualquer valor');
  });

  it('lists the fields of an object, marking the optional ones, and falls back to "objeto" with no fields', () => {
    const schema = {
      type: 'object' as const,
      properties: { id: { type: 'number' as const }, name: { type: 'string' as const } },
      required: ['id'],
    };
    expect(describeSchema(schema)).toBe('{ id: número; name?: texto }');
    expect(describeSchema({ type: 'object' })).toBe('objeto');
    expect(describeSchema({ type: 'object', properties: {} })).toBe('objeto');
  });

  it('names the types it knows in Portuguese and writes the others as they are', () => {
    expect(describeSchema({ type: 'boolean' })).toBe('booleano');
    expect(describeSchema({ type: 'null' })).toBe('null');
    expect(describeSchema({ type: 'integer' as never })).toBe('integer');
  });

  it('shows the TypeScript type of a schema with no type, when it has one', () => {
    expect(describeSchema({ 'x-ts': 'Date' })).toBe('qualquer valor (Date)');
    expect(describeSchema({})).toBe('qualquer valor');
  });
});
