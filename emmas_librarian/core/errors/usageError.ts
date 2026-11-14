import { AppError } from './AppError';

/**
 * A mistake in how a shell was called (not a failure of a command): the CLI exits 2 on these.
 *
 * Usage:
 *   throw usageError('ERR_CLI_USAGE', '--data-dir sem valor', 'um caminho de pasta depois de --data-dir');
 */
export function usageError(code: string, problem: string, expected: string): AppError {
  return new AppError(code, 'VALIDATION_ERROR', `[${code}] ${problem}. Expected shape: ${expected}.`);
}
