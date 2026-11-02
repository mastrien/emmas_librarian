import { describe, it, expect } from 'vitest';
import { investigationStatus, statusColour, statusTone } from '../investigationStatus';

describe('investigationStatus', () => {
  it.each([
    [[{}, {}], 'Sucesso'],
    [[{}, { error: 'x' }, {}], 'Concluída com erros (1 de 3)'],
    [[{ error: 'x' }, { error: 'y' }], 'Falhou'],
    [[], 'Sucesso'],
  ])('%o → %s', (outcomes, expected) => {
    expect(investigationStatus(outcomes)).toBe(expected);
  });
});

describe('statusTone', () => {
  it('is green for success, amber for a partial run and red for everything else', () => {
    expect(['Sucesso', 'Concluída com erros (1 de 3)', 'Falhou', 'Erro: Quota Excedida', null].map(statusTone)).toEqual(
      ['success', 'warning', 'danger', 'danger', 'danger'],
    );
    expect(statusColour('Concluída com erros (2 de 5)')).toBe('var(--color-warning)');
  });
});
