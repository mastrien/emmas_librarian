import { describe, it, expect } from 'vitest';
import { undoTexts } from '../undoTexts';

const entry = (breakdown: object) => ({ results_breakdown: JSON.stringify(breakdown) });

describe('undoTexts (#67)', () => {
  it.each([[{ Manual: { count: 1 } }], [{ import: { count: 3 } }]])(
    'warns about PRISMA when undoing %o, an entry from outside the searches',
    (breakdown) => {
      const texts = undoTexts(entry(breakdown));

      expect(texts.label).toBe('Desfazer inclusão');
      expect(texts.confirm).toContain('removidos permanentemente');
      expect(texts.confirm).toContain('arquive-o ou exclua-o na triagem');
    },
  );

  it('keeps the usual texts for a structured search', () => {
    const texts = undoTexts(entry({ openalex: { count: 10 }, scopus: { count: 4 } }));

    expect(texts.label).toBe('Desfazer Busca');
    expect(texts.confirm).not.toContain('PRISMA');
  });
});
