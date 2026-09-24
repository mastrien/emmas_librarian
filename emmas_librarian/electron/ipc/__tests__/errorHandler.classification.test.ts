import { describe, it, expect } from 'vitest';
import { AppError, withErrorHandling } from '../errorHandler';

interface SerializedAppError {
  isAppError: boolean;
  code: string;
  type: string;
  message: string;
  details?: unknown;
}

function errorWith(message: string, code?: string): Error {
  return Object.assign(new Error(message), code ? { code } : {});
}

async function classify(thrown: unknown): Promise<SerializedAppError> {
  const wrapped = withErrorHandling(async () => {
    throw thrown;
  });
  const rejection = await wrapped().catch((e: Error) => e);
  expect(rejection).toBeInstanceOf(Error);
  return JSON.parse((rejection as Error).message) as SerializedAppError;
}

describe('withErrorHandling classification', () => {
  it('preserves AppError details through serialization', async () => {
    const payload = await classify(new AppError('ERR_NOT_FOUND', 'USER_ERROR', 'missing', { id: 7 }));

    expect(payload).toEqual({
      isAppError: true,
      code: 'ERR_NOT_FOUND',
      type: 'USER_ERROR',
      message: 'missing',
      details: { id: 7 },
    });
  });

  it.each(['HTTP 429 Too Many Requests', 'RESOURCE QUOTA_EXCEEDED', 'insufficient_quota for org'])(
    'maps provider quota errors (%s) to ERR_API_QUOTA_EXCEEDED keeping the raw message',
    async (message) => {
      expect(await classify(errorWith(message))).toEqual({
        isAppError: true,
        code: 'ERR_API_QUOTA_EXCEEDED',
        type: 'SYSTEM_ERROR',
        message,
      });
    },
  );

  it.each([
    ['SQLite error code', errorWith('constraint', 'SQLITE_CONSTRAINT_UNIQUE')],
    ['SQLite message', errorWith('UNIQUE constraint failed: projects.name')],
  ])('maps unique violations (%s) to a user-facing ERR_DUPLICATE', async (_label, error) => {
    const payload = await classify(error);

    expect(payload).toMatchObject({ code: 'ERR_DUPLICATE', type: 'USER_ERROR' });
    expect(payload.message).toBe(
      `[ERR_DUPLICATE] Violação de unicidade no banco de dados. Valor conflitante detectado. Detalhes: ${error.message}`,
    );
  });

  it.each([
    ['SQLite error code', errorWith('busy', 'SQLITE_BUSY')],
    ['SQLite message', errorWith('database is locked')],
  ])('maps lock contention (%s) to ERR_DATABASE_LOCKED', async (_label, error) => {
    expect(await classify(error)).toEqual({
      isAppError: true,
      code: 'ERR_DATABASE_LOCKED',
      type: 'SYSTEM_ERROR',
      message: '[ERR_DATABASE_LOCKED] O banco de dados está temporariamente bloqueado. Tente novamente em instantes.',
    });
  });

  it.each([
    ['any other SQLITE_ code', errorWith('disk I/O error', 'SQLITE_IOERR')],
    ['a SqliteError message', errorWith('SqliteError: no such table: foo')],
  ])('maps other database failures (%s) to ERR_DATABASE', async (_label, error) => {
    expect(await classify(error)).toEqual({
      isAppError: true,
      code: 'ERR_DATABASE',
      type: 'SYSTEM_ERROR',
      message: `[ERR_DATABASE] Erro na operação de banco de dados. Causa: ${error.message}`,
    });
  });

  it.each([
    ['exact fetch failure', errorWith('fetch failed')],
    ['wrapped fetch failure', errorWith('TypeError: fetch failed (cause: timeout)')],
    ['refused connection', errorWith('connect', 'ECONNREFUSED')],
    ['unknown host', errorWith('getaddrinfo', 'ENOTFOUND')],
  ])('maps network failures (%s) to ERR_API_CONNECTION', async (_label, error) => {
    const payload = await classify(error);

    expect(payload).toMatchObject({ code: 'ERR_API_CONNECTION', type: 'SYSTEM_ERROR' });
    expect(payload.message).toMatch(/^\[ERR_API_CONNECTION\] Não foi possível conectar ao provedor de IA\./);
    expect(payload.message.endsWith(`(${error.message})`)).toBe(true);
  });

  it('falls back to ERR_INTERNAL for unrecognised errors', async () => {
    expect(await classify(errorWith('segfault', 'EPIPE'))).toEqual({
      isAppError: true,
      code: 'ERR_INTERNAL',
      type: 'SYSTEM_ERROR',
      message: 'segfault',
    });
  });

  it.each([
    ['a thrown string', 'plain failure', 'plain failure'],
    ['null', null, 'null'],
    ['an error without message', Object.assign(new Error(''), { code: 'X' }), 'Error'],
  ])('stringifies %s into ERR_INTERNAL', async (_label, thrown, message) => {
    expect(await classify(thrown)).toEqual({ isAppError: true, code: 'ERR_INTERNAL', type: 'SYSTEM_ERROR', message });
  });

  it('checks quota before database errors when both match', async () => {
    expect(await classify(errorWith('429 while database is locked'))).toMatchObject({ code: 'ERR_API_QUOTA_EXCEEDED' });
  });

  it('checks uniqueness before the generic SQLite bucket', async () => {
    expect(await classify(errorWith('SqliteError: UNIQUE constraint failed'))).toMatchObject({ code: 'ERR_DUPLICATE' });
  });

  it('checks lock contention before the generic SQLite bucket', async () => {
    expect(await classify(errorWith('locked', 'SQLITE_BUSY'))).toMatchObject({ code: 'ERR_DATABASE_LOCKED' });
  });
});
