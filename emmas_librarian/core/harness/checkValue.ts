import { describeSchema } from './describeSchema';
import type { ValueSchema } from './valueSchema';

/** One place where a value does not fit its schema: where, what was given, and what would have fit. */
export interface Violation {
  path: string;
  given: string;
  expected: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A short, readable form of what was given: the type and, for small values, the value itself. */
function givenAs(value: unknown): string {
  if (value === undefined) return 'ausente';
  const text = JSON.stringify(value);
  const shown = text.length > 60 ? `${text.slice(0, 57)}...` : text;
  return `${shown} (${Array.isArray(value) ? 'lista' : value === null ? 'null' : typeof value})`;
}

const violation = (path: string, value: unknown, schema: ValueSchema): Violation[] => [
  { path, given: givenAs(value), expected: describeSchema(schema) },
];

const ACCEPTS_ANYTHING = (schema: ValueSchema): boolean =>
  !schema.type && !schema.enum && schema.const === undefined && !schema.anyOf;

function checkObject(value: unknown, schema: ValueSchema, path: string): Violation[] {
  if (!isPlainObject(value)) return violation(path, value, schema);
  const known = schema.properties;
  if (!known) return [];
  const missing = (schema.required ?? []).filter((key) => value[key] === undefined);
  const absent = missing.map((key) => ({
    path: `${path}.${key}`,
    given: 'ausente',
    expected: describeSchema(known[key]),
  }));
  const unknown = Object.keys(value).filter((key) => !(key in known) && !schema.additionalProperties);
  const stray = unknown.map((key) => ({
    path: `${path}.${key}`,
    given: givenAs(value[key]),
    expected: `um destes campos: ${Object.keys(known).join(', ')}`,
  }));
  const inner = Object.entries(known).flatMap(([key, each]) =>
    value[key] === undefined ? [] : checkValue(value[key], each, `${path}.${key}`),
  );
  return [...absent, ...stray, ...inner];
}

function checkArray(value: unknown, schema: ValueSchema, path: string): Violation[] {
  if (!Array.isArray(value)) return violation(path, value, schema);
  const items = schema.items;
  return items ? value.flatMap((each, index) => checkValue(each, items, `${path}[${index}]`)) : [];
}

const PRIMITIVE_CHECKS: Record<string, (value: unknown) => boolean> = {
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  boolean: (value) => typeof value === 'boolean',
  null: (value) => value === null,
};

/**
 * Checks a value against a schema and lists every place it does not fit. The check is strict on
 * purpose: `"3"` is not the number 3, so a model that sends it is told, instead of the call being
 * quietly turned into a different one.
 *
 * Usage:
 *   checkValue('abc', { type: 'number' }, 'projectId'); // [{ path: 'projectId', given: '"abc" (string)', expected: 'número' }]
 */
export function checkValue(value: unknown, schema: ValueSchema, path: string): Violation[] {
  if (ACCEPTS_ANYTHING(schema)) return [];
  if (schema.const !== undefined) return value === schema.const ? [] : violation(path, value, schema);
  if (schema.enum) return schema.enum.includes(value as never) ? [] : violation(path, value, schema);
  if (schema.anyOf) {
    const fits = schema.anyOf.some((alternative) => checkValue(value, alternative, path).length === 0);
    return fits ? [] : violation(path, value, schema);
  }
  if (schema.type === 'object') return checkObject(value, schema, path);
  if (schema.type === 'array') return checkArray(value, schema, path);
  const check = schema.type ? PRIMITIVE_CHECKS[schema.type] : undefined;
  return check?.(value) ? [] : violation(path, value, schema);
}
