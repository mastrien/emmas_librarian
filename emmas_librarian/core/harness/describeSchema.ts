import type { ValueSchema } from './valueSchema';

const PRIMITIVE_LABELS: Record<string, string> = {
  string: 'texto',
  number: 'número',
  boolean: 'booleano',
  null: 'null',
};

function describeObject(schema: ValueSchema): string {
  const entries = Object.entries(schema.properties ?? {});
  if (entries.length === 0) return 'objeto';
  const required = new Set(schema.required ?? []);
  const fields = entries.map(([key, value]) => `${key}${required.has(key) ? '' : '?'}: ${describeSchema(value)}`);
  return `{ ${fields.join('; ')} }`;
}

/**
 * What a schema accepts, in words a model can act on when it is told its call was wrong.
 *
 * Usage:
 *   describeSchema({ enum: ['title', 'full'] }); // '"title" | "full"'
 *   describeSchema({ type: 'array', items: { type: 'number' } }); // 'lista de número'
 */
export function describeSchema(schema: ValueSchema): string {
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  if (schema.anyOf) return schema.anyOf.map(describeSchema).join(' | ');
  if (schema.type === 'array') return `lista de ${schema.items ? describeSchema(schema.items) : 'qualquer valor'}`;
  if (schema.type === 'object') return describeObject(schema);
  if (schema.type) return PRIMITIVE_LABELS[schema.type] ?? schema.type;
  return schema['x-ts'] ? `qualquer valor (${schema['x-ts']})` : 'qualquer valor';
}
