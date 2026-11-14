import { describe, it, expect } from 'vitest';
import { AppError } from '../AppError';
import { appErrorFrom } from '../appErrorFrom';

const sqliteFailure = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('appErrorFrom', () => {
  it('returns an AppError as it is', () => {
    const original = new AppError('ERR_NOT_FOUND', 'USER_ERROR', 'Projeto 7 não existe');

    expect(appErrorFrom(original)).toBe(original);
  });

  it.each([
    [new Error('429 Too Many Requests'), 'ERR_API_QUOTA_EXCEEDED', 'SYSTEM_ERROR'],
    [sqliteFailure('SQLITE_CONSTRAINT_UNIQUE', 'x'), 'ERR_DUPLICATE', 'USER_ERROR'],
    [new Error('UNIQUE constraint failed: projects.name'), 'ERR_DUPLICATE', 'USER_ERROR'],
    [sqliteFailure('SQLITE_BUSY', 'x'), 'ERR_DATABASE_LOCKED', 'SYSTEM_ERROR'],
    [sqliteFailure('SQLITE_ERROR', 'no such table'), 'ERR_DATABASE', 'SYSTEM_ERROR'],
    [sqliteFailure('ECONNREFUSED', 'connect'), 'ERR_API_CONNECTION', 'SYSTEM_ERROR'],
    [new Error('fetch failed'), 'ERR_API_CONNECTION', 'SYSTEM_ERROR'],
    [new Error('qualquer coisa'), 'ERR_INTERNAL', 'SYSTEM_ERROR'],
  ])('classifies %s as %s (%s)', (failure, code, type) => {
    expect(appErrorFrom(failure)).toMatchObject({ code, type });
  });

  it('keeps the original message of an unknown failure, even when it is not an Error', () => {
    expect(appErrorFrom(new Error('disco cheio')).message).toBe('disco cheio');
    expect(appErrorFrom('texto solto').message).toBe('texto solto');
    expect(appErrorFrom(null).message).toBe('null');
  });
});
