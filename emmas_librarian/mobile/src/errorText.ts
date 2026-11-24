/**
 * The words of an error for the screen: its message, or the value itself when it is not an `Error`.
 *
 * @example errorText(new Error('sem conexão')) // 'sem conexão'
 */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
