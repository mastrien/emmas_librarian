import { describe, it, expect } from 'vitest';
import { failureNotice } from '../failureNotice';

describe('failureNotice', () => {
  it('keeps the sentence plain and moves what the program said to the details', () => {
    const notice = failureNotice('Erro no upload', 'O PDF não foi enviado.', new Error('EACCES: permission denied'));

    expect(notice).toEqual({
      title: 'Erro no upload',
      message: 'O PDF não foi enviado.',
      tone: 'danger',
      details: 'EACCES: permission denied',
    });
  });

  it('reads a rejection that is not an Error (a string, or a payload with { error })', () => {
    expect(failureNotice('t', 'm', 'falhou').details).toBe('falhou');
    expect(failureNotice('t', 'm', { error: 'sem rede' }).details).toBe('sem rede');
  });
});
