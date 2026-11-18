import type { CommandSchema } from './commandSchema';
import generated from './commandSchemas.generated.json';

/**
 * The schemas of every command, as `npm run schemas:generate` wrote them from the handlers.
 *
 * Usage:
 *   const toolkit = new LibraryToolkit({ commands, schemas: commandSchemas() });
 */
export const commandSchemas = (): CommandSchema[] => generated.commands as CommandSchema[];
