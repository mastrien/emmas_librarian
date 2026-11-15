import ts from 'typescript';
import type { ValueSchema } from '../../core/harness/valueSchema';

const MAX_DEPTH = 4;

interface Walk {
  checker: ts.TypeChecker;
  depth: number;
  /** Types being expanded right now: a type that contains itself stops here instead of looping. */
  seen: ReadonlySet<ts.Type>;
}

/** What the type checker prints for a type, kept in the schema so a person can see what it came from. */
const nameOf = (type: ts.Type, checker: ts.TypeChecker): string => checker.typeToString(type);

const untyped = (type: ts.Type, checker: ts.TypeChecker): ValueSchema => ({ 'x-ts': nameOf(type, checker) });

function literalOf(type: ts.Type, checker: ts.TypeChecker): string | number | boolean | undefined {
  if (type.isStringLiteral() || type.isNumberLiteral()) return type.value;
  if (type.flags & ts.TypeFlags.BooleanLiteral) return nameOf(type, checker) === 'true';
  return undefined;
}

function isOptionalMember(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) !== 0;
}

function unionSchema(type: ts.UnionType, walk: Walk): ValueSchema {
  const members = type.types.filter((member) => !isOptionalMember(member));
  // `boolean` is `true | false` to the checker; it reads as one boolean again.
  const booleans = members.filter((member) => member.flags & ts.TypeFlags.BooleanLiteral);
  const rest = booleans.length === 2 ? members.filter((member) => !booleans.includes(member)) : members;
  const schemas = rest.map((member) => schemaOfType(member, walk));
  const withBoolean = booleans.length === 2 ? [...schemas, { type: 'boolean' } as ValueSchema] : schemas;
  return mergeAlternatives(withBoolean);
}

// Several string literals become one `enum`; anything else stays as the list of alternatives.
function mergeAlternatives(schemas: ValueSchema[]): ValueSchema {
  if (schemas.length === 1) return schemas[0];
  const literals = schemas.every((schema) => 'const' in schema);
  if (literals) return { enum: schemas.map((schema) => schema.const as string | number | boolean) };
  return { anyOf: schemas };
}

function objectSchema(type: ts.Type, walk: Walk): ValueSchema {
  const { checker } = walk;
  const properties: Record<string, ValueSchema> = {};
  const required: string[] = [];
  for (const property of checker.getPropertiesOfType(type)) {
    // Not getTypeOfSymbolAtLocation: the properties of a mapped type (`Partial<Record<K, V>>`) have no declaration.
    properties[property.name] = schemaOfType(checker.getTypeOfSymbol(property), { ...walk, depth: walk.depth + 1 });
    if (!(property.flags & ts.SymbolFlags.Optional)) required.push(property.name);
  }
  const index = checker.getIndexInfoOfType(type, ts.IndexKind.String);
  const extra = index ? { additionalProperties: schemaOfType(index.type, { ...walk, depth: walk.depth + 1 }) } : {};
  // Nothing known about its fields (an opaque type): any object fits, instead of one that may have no field at all.
  if (Object.keys(properties).length === 0 && !index) return { type: 'object', 'x-ts': nameOf(type, checker) };
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}), ...extra };
}

function arrayElementOf(type: ts.Type, checker: ts.TypeChecker): ts.Type | undefined {
  if (!checker.isArrayType(type)) return undefined;
  return checker.getTypeArguments(type as ts.TypeReference)[0];
}

function structuredSchema(type: ts.Type, walk: Walk): ValueSchema {
  const { checker } = walk;
  const element = arrayElementOf(type, checker);
  if (element) return { type: 'array', items: schemaOfType(element, { ...walk, depth: walk.depth + 1 }) };
  if (walk.seen.has(type) || walk.depth >= MAX_DEPTH) return { type: 'object', 'x-ts': nameOf(type, checker) };
  if (type.getCallSignatures().length > 0) return untyped(type, checker);
  return objectSchema(type, { ...walk, seen: new Set([...walk.seen, type]) });
}

const PRIMITIVES: ReadonlyArray<[ts.TypeFlags, ValueSchema['type']]> = [
  [ts.TypeFlags.StringLike, 'string'],
  [ts.TypeFlags.NumberLike, 'number'],
  [ts.TypeFlags.BooleanLike, 'boolean'],
  [ts.TypeFlags.Null, 'null'],
];

/**
 * The JSON-schema form of a TypeScript type: what a model is told about one argument of a command.
 * What cannot be expressed (functions, `any`, a type that contains itself) becomes a schema that accepts
 * anything and says in `x-ts` which type it was, so nothing is invented and nothing is lost silently.
 *
 * Usage:
 *   schemaOfType(checker.getTypeAtLocation(parameter), { checker, depth: 0, seen: new Set() });
 *   // { type: 'array', items: { type: 'number' } }
 */
export function schemaOfType(type: ts.Type, walk: Walk): ValueSchema {
  const { checker } = walk;
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return untyped(type, checker);
  const literal = literalOf(type, checker);
  if (literal !== undefined) return { const: literal };
  if (type.isUnion()) return unionSchema(type, walk);
  const primitive = PRIMITIVES.find(([flag]) => type.flags & flag);
  if (primitive) return { type: primitive[1] };
  return structuredSchema(type, walk);
}

export const newWalk = (checker: ts.TypeChecker): Walk => ({ checker, depth: 0, seen: new Set() });
