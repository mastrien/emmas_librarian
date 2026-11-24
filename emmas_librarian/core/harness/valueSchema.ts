/**
 * The subset of JSON Schema that describes one argument of a command. It is what a model is shown as
 * the type of an argument, and what the harness checks a call against before running it.
 *
 * Usage:
 *   const projectId: ValueSchema = { type: 'number' };
 *   const status: ValueSchema = { enum: ['included', 'excluded'] };
 */
export interface ValueSchema {
  type?: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
  enum?: Array<string | number | boolean>;
  const?: string | number | boolean;
  items?: ValueSchema;
  properties?: Record<string, ValueSchema>;
  required?: string[];
  additionalProperties?: ValueSchema;
  anyOf?: ValueSchema[];
  description?: string;
  /** The TypeScript type this came from, where the schema cannot say it all (a function, `any`, a recursive type). */
  'x-ts'?: string;
}
