import type { ValueSchema } from './valueSchema';

export interface ParameterSchema {
  /** The name the handler gives it; for an argument taken apart in the signature, the pattern (`{ id, venueData }`). */
  name: string;
  /** False for `x?: T`, a default value, or a type that includes `undefined`. */
  required: boolean;
  schema: ValueSchema;
}

/**
 * One command of the library as a model sees it: its name, its arguments with their types, and what
 * a person wrote about it. Generated from the handlers (`npm run schemas:generate`), never written by hand.
 *
 * Usage:
 *   const diarySave = schemas.find((schema) => schema.name === 'diary:save');
 */
export interface CommandSchema {
  name: string;
  parameters: ParameterSchema[];
  description?: string;
  /** Where the command is registered (`core/commands/diaryCommands.ts:15`), for a person to follow. */
  source: string;
}
