import { describe, it, expect } from 'vitest';
import type { ProjectDocument } from '../../../../../types';
import { groupByCategory } from '../quickAccessGroups';

const doc = (id: number, category?: string): ProjectDocument =>
  ({ id, project_id: 1, title: `Doc ${id}`, category }) as ProjectDocument;

describe('quick access groups (Arca 134)', () => {
  it('puts the uncategorised documents first and keeps the other groups in order of first appearance', () => {
    const groups = groupByCategory([doc(1, 'WORCAP'), doc(2), doc(3, 'Reuniões'), doc(4, ' WORCAP '), doc(5, '  ')]);

    expect(groups.map(([name, docs]) => [name, docs.map((d) => d.id)])).toEqual([
      ['', [2, 5]],
      ['WORCAP', [1, 4]],
      ['Reuniões', [3]],
    ]);
  });
});
