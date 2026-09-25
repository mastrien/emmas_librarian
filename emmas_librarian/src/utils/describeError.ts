/**
 * Turns anything a promise can reject with (Error, string, `{ error }` payload, primitive) into a readable message.
 *
 * Usage:
 *   alert(`Erro ao salvar: ${describeError(err)}`);
 */
export function describeError(err: unknown, fallback = 'Erro desconhecido'): string {
  if (!err) return fallback;
  if ((err as Error).message) return (err as Error).message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') return describeObject(err as { error?: string });
  return String(err);
}

// JSON.stringify throws on circular structures; fall back to the default object description.
function describeObject(err: { error?: string }): string {
  try {
    return err.error || JSON.stringify(err);
  } catch {
    return String(err);
  }
}
