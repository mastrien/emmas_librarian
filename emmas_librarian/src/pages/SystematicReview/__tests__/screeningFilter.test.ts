import { describe, expect, it } from 'vitest';
import type { ScreeningLabel } from '../../../types';
import { defaultFilter, filterCount, quickLabel } from '../screeningFilter';

const counts = { include: 2, maybe: 1, exclude: 3, removed: 1, pending: 5, unlabeled: 2 };

describe('screeningFilter', () => {
  it('counts the articles archived without a label with the exclusions', () => {
    expect(filterCount(counts, 'exclude')).toBe(5);
    expect(filterCount(counts, 'pending')).toBe(5);
    expect(filterCount(counts, 'removed')).toBe(1);
  });

  it('opens on what waits for a decision, else on the included ones', () => {
    expect(defaultFilter(counts)).toBe('pending');
    expect(defaultFilter({ ...counts, pending: 0 })).toBe('include');
  });

  it('decides quickly with the first label of the kind, and with none when the project has none', () => {
    const labels = [
      { id: 1, name: 'Fora do tema', kind: 'exclude' },
      { id: 2, name: 'Excluído', kind: 'exclude' },
      { id: 3, name: 'Incluso', kind: 'include' },
    ] as ScreeningLabel[];

    expect(quickLabel(labels, 'exclude')?.name).toBe('Fora do tema');
    expect(quickLabel(labels, 'maybe')).toBeUndefined();
  });
});
