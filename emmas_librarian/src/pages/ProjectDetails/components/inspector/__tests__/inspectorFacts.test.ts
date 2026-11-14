import { describe, expect, it } from 'vitest';
import { accessName, authorsPreview, statusName, venueLine } from '../inspectorFacts';

describe('statusName', () => {
  it('names each status, an article without one as active', () => {
    expect(statusName({ status: 'read' })).toBe('Lido');
    expect(statusName({ status: 'archived' })).toBe('Arquivado');
    expect(statusName({ status: undefined } as never)).toBe('Ativo');
  });
});

describe('accessName', () => {
  it('says open or closed only when the base reported it', () => {
    expect(accessName({ is_oa: 1 })).toBe('Aberto');
    expect(accessName({ is_oa: 0 })).toBe('Fechado');
    expect(accessName({ is_oa: undefined })).toBeNull();
  });
});

describe('authorsPreview', () => {
  it('shows five authors and counts the rest', () => {
    expect(authorsPreview('A; B; C; D; E; F; G')).toEqual({ shown: ['A', 'B', 'C', 'D', 'E'], hidden: 2 });
    expect(authorsPreview('')).toEqual({ shown: [], hidden: 0 });
  });
});

describe('venueLine', () => {
  it('joins the venue and the year, leaving out what is missing', () => {
    expect(venueLine({ journal: 'Nature', year: 2020 })).toBe('Nature · 2020');
    expect(venueLine({ year: 2020 })).toBe('2020');
  });
});
