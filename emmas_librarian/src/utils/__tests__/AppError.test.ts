import { describe, it, expect } from 'vitest';
import { FrontendAppError, parseIpcError } from '../AppError';

describe('FrontendAppError', () => {
  it('keeps code, type, details and instanceof', () => {
    const error = new FrontendAppError('ERR_NOT_FOUND', 'USER_ERROR', 'missing', { id: 1 });

    expect(error).toBeInstanceOf(FrontendAppError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: 'FrontendAppError', code: 'ERR_NOT_FOUND', type: 'USER_ERROR', isAppError: true });
    expect(error.details).toEqual({ id: 1 });
  });
});

describe('parseIpcError', () => {
  it('returns a generic error for a falsy value', () => {
    expect(parseIpcError(null).message).toBe('Unknown error');
  });

  it('extracts an AppError payload embedded in the IPC message', () => {
    const payload = JSON.stringify({ isAppError: true, code: 'ERR_INVALID_PDF', type: 'VALIDATION_ERROR', message: 'bad pdf' });

    const parsed = parseIpcError(new Error(`Error invoking remote method 'x': Error: ${payload}`));

    expect(parsed).toBeInstanceOf(FrontendAppError);
    expect(parsed).toMatchObject({ code: 'ERR_INVALID_PDF', type: 'VALIDATION_ERROR', message: 'bad pdf' });
  });

  it('parses a string rejection with an AppError payload', () => {
    const payload = JSON.stringify({ isAppError: true, code: 'ERR_INTERNAL', type: 'SYSTEM_ERROR', message: 'boom' });

    expect(parseIpcError(payload)).toMatchObject({ code: 'ERR_INTERNAL', message: 'boom' });
  });

  it('returns the original error when the embedded JSON is not an AppError', () => {
    const original = new Error('Error: {"foo":1}');

    expect(parseIpcError(original)).toBe(original);
  });

  it('returns the original error when the braces do not contain valid JSON', () => {
    const original = new Error('Error: {not json}');

    expect(parseIpcError(original)).toBe(original);
  });

  it('returns the original error when there is no JSON at all', () => {
    const original = new Error('ECONNRESET');

    expect(parseIpcError(original)).toBe(original);
  });
});
