import { describe, it, expect } from 'vitest';
import { FrontendAppError } from '../../../../utils/AppError';
import { appErrorView, technicalReport } from '../appErrorView';

describe('appErrorView', () => {
  it('reads a typed app error by its code and type', () => {
    const view = appErrorView(new FrontendAppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'no key', { field: 'x' }));
    expect(view).toMatchObject({
      code: 'ERR_MISSING_API_KEY',
      title: 'Chave de API Ausente',
      isUserError: true,
      rawMessage: 'no key',
      details: { field: 'x' },
    });
  });

  it('reads anything else as an internal system failure', () => {
    expect(appErrorView(new Error('boom'))).toMatchObject({
      code: 'ERR_INTERNAL',
      type: 'SYSTEM_ERROR',
      title: 'Falha no Sistema',
      isUserError: false,
      rawMessage: 'boom',
    });
    expect(appErrorView('texto').rawMessage).toBe('texto');
  });
});

describe('technicalReport', () => {
  it('puts type, code, message and stack on separate lines', () => {
    const view = { ...appErrorView(new Error('boom')), stack: 'at x' };
    expect(technicalReport(view)).toBe('Type: SYSTEM_ERROR\nCode: ERR_INTERNAL\nMessage: boom\nStack: at x');
  });
});
