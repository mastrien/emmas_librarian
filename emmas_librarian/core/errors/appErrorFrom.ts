import { AppError } from './AppError';

interface RawFailure {
  message?: string;
  code?: string;
}

const DUPLICATE = (message: string) =>
  `[ERR_DUPLICATE] Violação de unicidade no banco de dados. Valor conflitante detectado. Detalhes: ${message}`;
const DATABASE_LOCKED =
  '[ERR_DATABASE_LOCKED] O banco de dados está temporariamente bloqueado. Tente novamente em instantes.';
const DATABASE = (message: string) => `[ERR_DATABASE] Erro na operação de banco de dados. Causa: ${message}`;
const API_CONNECTION = (message: string) =>
  `[ERR_API_CONNECTION] Não foi possível conectar ao provedor de IA. Verifique sua conexão com a internet ou se o serviço local de IA está em execução. (${message})`;

const isQuota = (message: string) =>
  message.includes('429') || message.includes('QUOTA_EXCEEDED') || message.includes('insufficient_quota');
const isDuplicate = (message: string, code?: string) =>
  code === 'SQLITE_CONSTRAINT_UNIQUE' || message.includes('UNIQUE constraint failed');
const isLocked = (message: string, code?: string) => code === 'SQLITE_BUSY' || message.includes('database is locked');
const isSqlite = (message: string, code?: string) =>
  Boolean(code?.startsWith?.('SQLITE_')) || message.includes('SqliteError');
const isFetchFailed = (message: string, code?: string) =>
  message.includes('fetch failed') || code === 'ECONNREFUSED' || code === 'ENOTFOUND';

/**
 * Turns anything a command threw into an AppError with a stable code, so every transport (IPC, CLI,
 * HTTP) reports the same failure the same way. An AppError comes back as it is.
 *
 * Usage:
 *   appErrorFrom(new Error('database is locked')).code; // 'ERR_DATABASE_LOCKED'
 */
export function appErrorFrom(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const raw = (error ?? {}) as RawFailure;
  const message = raw.message || String(error);
  if (isQuota(message)) return new AppError('ERR_API_QUOTA_EXCEEDED', 'SYSTEM_ERROR', message);
  if (isDuplicate(message, raw.code)) return new AppError('ERR_DUPLICATE', 'USER_ERROR', DUPLICATE(message));
  if (isLocked(message, raw.code)) return new AppError('ERR_DATABASE_LOCKED', 'SYSTEM_ERROR', DATABASE_LOCKED);
  if (isSqlite(message, raw.code)) return new AppError('ERR_DATABASE', 'SYSTEM_ERROR', DATABASE(message));
  if (isFetchFailed(message, raw.code)) {
    return new AppError('ERR_API_CONNECTION', 'SYSTEM_ERROR', API_CONNECTION(message));
  }
  return new AppError('ERR_INTERNAL', 'SYSTEM_ERROR', message);
}
