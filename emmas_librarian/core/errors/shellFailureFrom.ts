import { AppError } from './AppError';
import { appErrorFrom } from './appErrorFrom';

const BRACKET_CODE = /^\[(ERR_[A-Z_]+)\]/;

/**
 * The failure as a shell outside the app reports it (CLI, LAN server). Commands written before
 * AppError throw plain errors whose message starts with their code ("[ERR_NOT_FOUND] ..."): those keep
 * that code and count as rejected input instead of an internal error.
 *
 * Usage:
 *   shellFailureFrom(new Error('[ERR_NOT_FOUND] Projeto não encontrado')).code; // 'ERR_NOT_FOUND'
 */
export function shellFailureFrom(error: unknown): AppError {
  const classified = appErrorFrom(error);
  const bracketed = BRACKET_CODE.exec(classified.message)?.[1];
  if (classified.code !== 'ERR_INTERNAL' || !bracketed) return classified;
  return new AppError(bracketed, 'USER_ERROR', classified.message);
}
