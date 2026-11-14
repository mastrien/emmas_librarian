import { describe, it, expect } from 'vitest';
import { shellFailureFrom } from '../shellFailureFrom';

describe('shellFailureFrom', () => {
  it('keeps the code a plain error carries at the start of its message', () => {
    expect(shellFailureFrom(new Error('[ERR_NOT_FOUND] PDF não encontrado'))).toMatchObject({
      code: 'ERR_NOT_FOUND',
      type: 'USER_ERROR',
      message: '[ERR_NOT_FOUND] PDF não encontrado',
    });
  });

  it('leaves classified failures as they are', () => {
    expect(shellFailureFrom(new Error('UNIQUE constraint failed: projects.name')).code).toBe('ERR_DUPLICATE');
    expect(shellFailureFrom(new Error('sem código')).code).toBe('ERR_INTERNAL');
  });
});
